/**
 * Admin routes for listings, users, and feedback.
 */

const express = require("express");

const { db } = require("../../cloudbase");
const { listCollection } = require("../../init-db");

const router = express.Router();
const PAGE_SIZE = 20;

function getDocId(doc) {
  return doc.id || doc._id || "";
}

function getOpenId(doc) {
  return doc.openid || doc.open_id || "";
}

function getListingType(listing) {
  return listing.listing_type || "sale";
}

function normalizeListingStatus(listing) {
  const rawStatus = String(listing?.status || "").trim();
  if (rawStatus === "removed") {
    return "off_shelf";
  }
  return rawStatus || "pending_review";
}

function getListingOwnerKey(listing) {
  return listing.seller_id || listing.user_id || getOpenId(listing);
}

function getFeedbackOwnerKey(feedback) {
  return feedback.user_id || feedback.openid || feedback.open_id || "";
}

function toTimestamp(value) {
  if (value instanceof Date) {
    return value.getTime();
  }

  return Number(value || 0);
}

function paginate(items, page) {
  const currentPage = Math.max(Number(page || 1), 1);
  const offset = (currentPage - 1) * PAGE_SIZE;

  return {
    items: items.slice(offset, offset + PAGE_SIZE),
    currentPage,
    totalPages: Math.max(Math.ceil(items.length / PAGE_SIZE), 1),
    total: items.length,
  };
}

function buildUserMaps(users) {
  const byId = new Map();
  const byOpenId = new Map();

  users.forEach((user) => {
    const docId = getDocId(user);
    const openid = getOpenId(user);

    if (docId) {
      byId.set(docId, user);
    }

    if (openid) {
      byOpenId.set(openid, user);
    }
  });

  return { byId, byOpenId };
}

function resolveUser(key, userMaps) {
  if (!key) {
    return null;
  }

  return userMaps.byId.get(key) || userMaps.byOpenId.get(key) || null;
}

async function recordAdminAction(req, targetType, targetId, action, note = "") {
  try {
    await db.collection("admin_actions").add({
      admin_user_id: req.session.user.id,
      target_type: targetType,
      target_id: targetId,
      action,
      action_note: note,
      created_at: Date.now(),
    });
  } catch (error) {
    console.error("Failed to record admin action:", error.message);
  }
}

async function loadBaseCollections() {
  const [users, districts, listings, listingImages, feedbacks, conversations, messages] =
    await Promise.all([
      listCollection("users", 200),
      listCollection("districts", 200),
      listCollection("listings", 200),
      listCollection("listing_images", 500),
      listCollection("feedback", 200),
      listCollection("conversations", 200),
      listCollection("messages", 500),
    ]);

  return {
    users,
    userMaps: buildUserMaps(users),
    districts,
    listings,
    listingImages,
    feedbacks,
    conversations,
    messages,
  };
}

async function findListingForAdmin(listingId) {
  const value = String(listingId || "").trim();
  if (!value) {
    return null;
  }

  const listings = await listCollection("listings", 300);
  return (
    listings.find((item) => {
      const candidates = [item.id, item._id].filter(Boolean).map((candidate) => String(candidate));
      return candidates.includes(value);
    }) || null
  );
}

router.get("/", (req, res) => {
  res.redirect("/admin/listings");
});

router.get("/listings", async (req, res) => {
  try {
    const { status = "all", keyword = "", type = "all", page = 1 } = req.query;
    const normalizedStatus = status === "removed" ? "off_shelf" : status;
    const { listings, userMaps, districts } = await loadBaseCollections();
    const districtMap = new Map(districts.map((district) => [district.code, district]));
    const searchValue = String(keyword || "").trim().toLowerCase();

    const filtered = listings
      .map((listing) => {
        const seller = resolveUser(getListingOwnerKey(listing), userMaps);
        const district = districtMap.get(listing.district_code);
        return {
          ...listing,
          status: normalizeListingStatus(listing),
          listing_type: getListingType(listing),
          seller_nickname: seller?.nickname || "未知用户",
          district_name: district?.name || listing.district_name || listing.district_code || "-",
        };
      })
      .filter((listing) => (normalizedStatus === "all" ? true : listing.status === normalizedStatus))
      .filter((listing) => (type === "all" ? true : getListingType(listing) === type))
      .filter((listing) => {
        if (!searchValue) {
          return true;
        }

        return [listing.title, listing.description, listing.seller_nickname]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(searchValue));
      })
      .sort((left, right) => toTimestamp(right.created_at) - toTimestamp(left.created_at));

    const pagination = paginate(filtered, page);

    res.render("listings/index", {
      title: "商品与求购管理",
      listings: pagination.items,
      currentStatus: normalizedStatus,
      currentType: type,
      keyword,
      currentPage: pagination.currentPage,
      totalPages: pagination.totalPages,
      total: pagination.total,
      statusOptions: [
        { value: "pending_review", label: "待审核" },
        { value: "approved", label: "已通过" },
        { value: "rejected", label: "已拒绝" },
        { value: "off_shelf", label: "已下架" },
        { value: "all", label: "全部" },
      ],
      typeOptions: [
        { value: "all", label: "全部类型" },
        { value: "sale", label: "出售帖" },
        { value: "wanted", label: "求购帖" },
      ],
    });
  } catch (error) {
    console.error("Failed to load listings:", error);
    req.flash("error", "商品列表加载失败。");
    res.redirect("/");
  }
});

router.get("/listings/:id", async (req, res) => {
  try {
    const listingId = req.params.id;
    const { listings, listingImages, userMaps, conversations, messages, districts } =
      await loadBaseCollections();
    const listing = listings.find((item) => getDocId(item) === listingId);

    if (!listing) {
      req.flash("error", "商品不存在。");
      return res.redirect("/admin/listings");
    }

    const seller = resolveUser(getListingOwnerKey(listing), userMaps);
    const district = districts.find((item) => item.code === listing.district_code);
    const images = listingImages
      .filter((image) => image.listing_id === listingId)
      .sort((left, right) => Number(left.order || left.sort_order || 0) - Number(right.order || right.sort_order || 0));
    const relatedConversations = conversations.filter((item) => item.listing_id === listingId);
    const relatedMessageCount = messages.filter((item) =>
      relatedConversations.some((conversation) => getDocId(conversation) === item.conversation_id),
    ).length;

    res.render("listings/show", {
      title: "商品详情",
      listing: {
        ...listing,
        status: normalizeListingStatus(listing),
        listing_type: getListingType(listing),
        district_name: district?.name || listing.district_name || listing.district_code || "-",
      },
      seller,
      images,
      metrics: {
        conversationCount: relatedConversations.length,
        messageCount: relatedMessageCount,
      },
    });
  } catch (error) {
    console.error("Failed to load listing detail:", error);
    req.flash("error", "商品详情加载失败。");
    res.redirect("/admin/listings");
  }
});

router.post("/__disabled/listings/:id/approve", async (req, res) => {
  const listingId = req.params.id;
  const note = String(req.body.note || "").trim();

  try {
    const listing = await findListingForAdmin(listingId);
    if (!listing?._id) {
      req.flash("error", "商品不存在。");
      return res.redirect("/admin/listings");
    }

    await db.collection("listings").doc(listing._id).update({
      status: "approved",
      review_status: "approved",
      reject_reason: "",
      updated_at: Date.now(),
    });

    await recordAdminAction(req, "listing", listingId, "approve", note);
    req.flash("success", "审核已通过。");
    res.redirect(`/admin/listings/${listingId}`);
  } catch (error) {
    console.error("Failed to approve listing:", error);
    req.flash("error", "审核通过失败。");
    res.redirect("/admin/listings");
  }
});

router.post("/listings/:id/reject", async (req, res) => {
  const listingId = req.params.id;
  const reason = String(req.body.reason || "").trim();

  if (!reason) {
    req.flash("error", "拒绝时必须填写原因。");
    return res.redirect(`/admin/listings/${listingId}`);
  }

  try {
    const listing = await findListingForAdmin(listingId);
    if (!listing?._id) {
      req.flash("error", "商品不存在。");
      return res.redirect("/admin/listings");
    }

    await db.collection("listings").doc(listing._id).update({
      status: "rejected",
      review_status: "rejected",
      reject_reason: reason,
      updated_at: Date.now(),
    });

    await recordAdminAction(req, "listing", listingId, "reject", reason);
    req.flash("success", "商品已拒绝。");
    res.redirect(`/admin/listings/${listingId}`);
  } catch (error) {
    console.error("Failed to reject listing:", error);
    req.flash("error", "商品拒绝失败。");
    res.redirect("/admin/listings");
  }
});

router.post("/listings/:id/remove", async (req, res) => {
  const listingId = req.params.id;
  const reason = String(req.body.reason || "").trim();

  try {
    const listing = await findListingForAdmin(listingId);
    if (!listing?._id) {
      req.flash("error", "商品不存在。");
      return res.redirect("/admin/listings");
    }

    await db.collection("listings").doc(listing._id).update({
      status: "off_shelf",
      review_status: "off_shelf",
      reject_reason: reason,
      updated_at: Date.now(),
    });

    await recordAdminAction(req, "listing", listingId, "remove", reason);
    req.flash("success", "商品已下架。");
    res.redirect(`/admin/listings/${listingId}`);
  } catch (error) {
    console.error("Failed to remove listing:", error);
    req.flash("error", "商品下架失败。");
    res.redirect("/admin/listings");
  }
});

router.post("/listings/:id/restore", async (req, res) => {
  const listingId = req.params.id;
  const note = String(req.body.note || "").trim();

  try {
    const listing = await findListingForAdmin(listingId);
    if (!listing?._id) {
      req.flash("error", "商品不存在。");
      return res.redirect("/admin/listings");
    }

    await db.collection("listings").doc(listing._id).update({
      status: "approved",
      review_status: "approved",
      reject_reason: "",
      updated_at: Date.now(),
    });

    await recordAdminAction(req, "listing", listingId, "restore", note);
    req.flash("success", "商品已重新上架。");
    res.redirect(`/admin/listings/${listingId}`);
  } catch (error) {
    console.error("Failed to restore listing:", error);
    req.flash("error", "商品重新上架失败。");
    res.redirect("/admin/listings");
  }
});

router.get("/users", async (req, res) => {
  try {
    const { status = "all", role = "all", keyword = "", page = 1 } = req.query;
    const { users, listings } = await loadBaseCollections();
    const searchValue = String(keyword || "").trim().toLowerCase();
    const listingCountMap = new Map();

    listings.forEach((listing) => {
      const key = getListingOwnerKey(listing);
      if (!key) {
        return;
      }

      listingCountMap.set(key, Number(listingCountMap.get(key) || 0) + 1);
    });

    const filtered = users
      .map((user) => {
        const docId = getDocId(user);
        const openid = getOpenId(user);
        return {
          ...user,
          listing_count:
            Number(listingCountMap.get(docId) || 0) + Number(listingCountMap.get(openid) || 0),
        };
      })
      .filter((user) => (status === "all" ? true : user.status === status))
      .filter((user) => (role === "all" ? true : (user.role || "user") === role))
      .filter((user) => {
        if (!searchValue) {
          return true;
        }

        return [user.nickname, getOpenId(user), getDocId(user)]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(searchValue));
      })
      .sort((left, right) => toTimestamp(right.created_at) - toTimestamp(left.created_at));

    const pagination = paginate(filtered, page);

    res.render("users/index", {
      title: "用户与客服管理",
      users: pagination.items,
      currentStatus: status,
      currentRole: role,
      keyword,
      currentPage: pagination.currentPage,
      totalPages: pagination.totalPages,
      total: pagination.total,
      statusOptions: [
        { value: "all", label: "全部状态" },
        { value: "active", label: "正常" },
        { value: "disabled", label: "已禁用" },
      ],
      roleOptions: [
        { value: "all", label: "全部角色" },
        { value: "user", label: "普通用户" },
        { value: "customer_service", label: "客服" },
        { value: "admin", label: "管理员" },
      ],
    });
  } catch (error) {
    console.error("Failed to load users:", error);
    req.flash("error", "用户列表加载失败。");
    res.redirect("/");
  }
});

router.post("/users/:id/disable", async (req, res) => {
  const userId = req.params.id;
  const reason = String(req.body.reason || "").trim();

  try {
    await db.collection("users").doc(userId).update({
      status: "disabled",
      updated_at: Date.now(),
    });

    await recordAdminAction(req, "user", userId, "disable", reason);
    req.flash("success", "账号已禁用。");
    res.redirect("/admin/users");
  } catch (error) {
    console.error("Failed to disable user:", error);
    req.flash("error", "禁用账号失败。");
    res.redirect("/admin/users");
  }
});

router.post("/users/:id/enable", async (req, res) => {
  const userId = req.params.id;

  try {
    await db.collection("users").doc(userId).update({
      status: "active",
      updated_at: Date.now(),
    });

    await recordAdminAction(req, "user", userId, "enable");
    req.flash("success", "账号已恢复。");
    res.redirect("/admin/users");
  } catch (error) {
    console.error("Failed to enable user:", error);
    req.flash("error", "恢复账号失败。");
    res.redirect("/admin/users");
  }
});

router.post("/users/:id/make-service", async (req, res) => {
  const userId = req.params.id;

  try {
    await db.collection("users").doc(userId).update({
      role: "customer_service",
      status: "active",
      updated_at: Date.now(),
    });

    await recordAdminAction(req, "user", userId, "make_service");
    req.flash("success", "该账号已提升为客服。");
    res.redirect("/admin/users");
  } catch (error) {
    console.error("Failed to grant service role:", error);
    req.flash("error", "设置客服失败。");
    res.redirect("/admin/users");
  }
});

router.post("/users/:id/remove-service", async (req, res) => {
  const userId = req.params.id;

  try {
    await db.collection("users").doc(userId).update({
      role: "user",
      updated_at: Date.now(),
    });

    await recordAdminAction(req, "user", userId, "remove_service");
    req.flash("success", "客服角色已移除。");
    res.redirect("/admin/users");
  } catch (error) {
    console.error("Failed to remove service role:", error);
    req.flash("error", "移除客服失败。");
    res.redirect("/admin/users");
  }
});

router.get("/feedback", async (req, res) => {
  try {
    const { status = "all", page = 1 } = req.query;
    const { feedbacks, userMaps } = await loadBaseCollections();
    const filtered = feedbacks
      .map((feedback) => ({
        ...feedback,
        user: resolveUser(getFeedbackOwnerKey(feedback), userMaps),
      }))
      .filter((feedback) => (status === "all" ? true : feedback.status === status))
      .sort((left, right) => toTimestamp(right.created_at) - toTimestamp(left.created_at));

    const pagination = paginate(filtered, page);

    res.render("feedback/index", {
      title: "反馈与举报管理",
      feedbacks: pagination.items,
      currentStatus: status,
      currentPage: pagination.currentPage,
      totalPages: pagination.totalPages,
      total: pagination.total,
      statusOptions: [
        { value: "all", label: "全部状态" },
        { value: "new", label: "待处理" },
        { value: "processing", label: "处理中" },
        { value: "closed", label: "已关闭" },
      ],
    });
  } catch (error) {
    console.error("Failed to load feedback:", error);
    req.flash("error", "反馈列表加载失败。");
    res.redirect("/");
  }
});

router.get("/feedback/:id", async (req, res) => {
  try {
    const feedbackId = req.params.id;
    const { feedbacks, userMaps } = await loadBaseCollections();
    const feedback = feedbacks.find((item) => getDocId(item) === feedbackId);

    if (!feedback) {
      req.flash("error", "反馈不存在。");
      return res.redirect("/admin/feedback");
    }

    res.render("feedback/show", {
      title: "反馈详情",
      feedback,
      user: resolveUser(getFeedbackOwnerKey(feedback), userMaps),
      backPath: "/admin/feedback",
      statusAction: `/admin/feedback/${feedbackId}/status`,
    });
  } catch (error) {
    console.error("Failed to load feedback detail:", error);
    req.flash("error", "反馈详情加载失败。");
    res.redirect("/admin/feedback");
  }
});

router.post("/feedback/:id/status", async (req, res) => {
  const feedbackId = req.params.id;
  const status = String(req.body.status || "").trim();

  if (!["new", "processing", "closed"].includes(status)) {
    req.flash("error", "状态值无效。");
    return res.redirect(`/admin/feedback/${feedbackId}`);
  }

  try {
    await db.collection("feedback").doc(feedbackId).update({
      status,
      updated_at: Date.now(),
    });

    await recordAdminAction(req, "feedback", feedbackId, "update_status", status);
    req.flash("success", "反馈状态已更新。");
    res.redirect(`/admin/feedback/${feedbackId}`);
  } catch (error) {
    console.error("Failed to update feedback:", error);
    req.flash("error", "反馈状态更新失败。");
    res.redirect(`/admin/feedback/${feedbackId}`);
  }
});

module.exports = router;
