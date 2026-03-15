/**
 * Customer-service dashboard routes.
 */

const express = require("express");

const { db } = require("../../cloudbase");
const { listCollection } = require("../../init-db");

const router = express.Router();

function getDocId(doc) {
  return doc.id || doc._id || "";
}

function getOpenId(doc) {
  return doc.openid || doc.open_id || "";
}

function getDisplayName(user, fallback = "未知用户") {
  return user?.nickname || fallback;
}

function toTimestamp(value) {
  if (value instanceof Date) {
    return value.getTime();
  }

  return Number(value || 0);
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

async function recordServiceAction(req, targetId, status) {
  try {
    await db.collection("admin_actions").add({
      admin_user_id: req.session.user.id,
      target_type: "feedback",
      target_id: targetId,
      action: "service_update_status",
      action_note: status,
      created_at: Date.now(),
    });
  } catch (error) {
    console.error("Failed to record service action:", error.message);
  }
}

router.get("/dashboard", async (req, res) => {
  try {
    const [users, listings, conversations, messages, feedbacks, districts] = await Promise.all([
      listCollection("users", 200),
      listCollection("listings", 200),
      listCollection("conversations", 200),
      listCollection("messages", 500),
      listCollection("feedback", 200),
      listCollection("districts", 200),
    ]);

    const userMaps = buildUserMaps(users);
    const listingMap = new Map(
      listings.map((listing) => [getDocId(listing), listing]),
    );
    const districtMap = new Map(districts.map((item) => [item.code, item]));

    const recentConversations = conversations
      .map((conversation) => {
        const listing = listingMap.get(conversation.listing_id);
        const buyer = resolveUser(conversation.buyer_openid, userMaps);
        const seller = resolveUser(conversation.seller_openid, userMaps);
        const district = districtMap.get(listing?.district_code);

        return {
          ...conversation,
          listing_title: listing?.title || "商品已删除",
          listing_type: listing?.listing_type || "sale",
          district_name: district?.name || listing?.district_name || listing?.district_code || "-",
          buyer_name: getDisplayName(buyer, "买家"),
          seller_name: getDisplayName(seller, "卖家"),
        };
      })
      .sort((left, right) => toTimestamp(right.updated_at) - toTimestamp(left.updated_at))
      .slice(0, 12);

    const pendingFeedbacks = feedbacks
      .map((feedback) => ({
        ...feedback,
        user: resolveUser(feedback.user_id || feedback.openid || feedback.open_id, userMaps),
      }))
      .filter((feedback) => feedback.status !== "closed")
      .sort((left, right) => toTimestamp(right.created_at) - toTimestamp(left.created_at))
      .slice(0, 10);

    const stats = {
      conversationCount: conversations.length,
      messageCount: messages.length,
      pendingFeedbackCount: feedbacks.filter((item) => item.status !== "closed").length,
      todayMessageCount: messages.filter((item) => {
        const date = new Date(toTimestamp(item.created_at));
        const now = new Date();
        return (
          date.getFullYear() === now.getFullYear() &&
          date.getMonth() === now.getMonth() &&
          date.getDate() === now.getDate()
        );
      }).length,
    };

    res.render("service/dashboard", {
      title: "客服工作台",
      stats,
      recentConversations,
      pendingFeedbacks,
    });
  } catch (error) {
    console.error("Failed to load service dashboard:", error);
    req.flash("error", "客服工作台加载失败。");
    res.redirect("/");
  }
});

router.get("/feedback/:id", async (req, res) => {
  try {
    const feedbackId = req.params.id;
    const [feedbacks, users] = await Promise.all([
      listCollection("feedback", 200),
      listCollection("users", 200),
    ]);
    const feedback = feedbacks.find((item) => getDocId(item) === feedbackId);

    if (!feedback) {
      req.flash("error", "反馈不存在。");
      return res.redirect("/service/dashboard");
    }

    const userMaps = buildUserMaps(users);
    const user = resolveUser(feedback.user_id || feedback.openid || feedback.open_id, userMaps);

    res.render("feedback/show", {
      title: "反馈详情",
      feedback,
      user,
      backPath: "/service/dashboard",
      statusAction: `/service/feedback/${feedbackId}/status`,
    });
  } catch (error) {
    console.error("Failed to load service feedback detail:", error);
    req.flash("error", "反馈详情加载失败。");
    res.redirect("/service/dashboard");
  }
});

router.post("/feedback/:id/status", async (req, res) => {
  const feedbackId = req.params.id;
  const status = String(req.body.status || "").trim();

  if (!["new", "processing", "closed"].includes(status)) {
    req.flash("error", "状态值无效。");
    return res.redirect(`/service/feedback/${feedbackId}`);
  }

  try {
    await db.collection("feedback").doc(feedbackId).update({
      status,
      updated_at: Date.now(),
    });

    await recordServiceAction(req, feedbackId, status);
    req.flash("success", "反馈状态已更新。");
    res.redirect(`/service/feedback/${feedbackId}`);
  } catch (error) {
    console.error("Failed to update feedback in service web:", error);
    req.flash("error", "状态更新失败。");
    res.redirect(`/service/feedback/${feedbackId}`);
  }
});

module.exports = router;
