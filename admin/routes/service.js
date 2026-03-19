/**
 * Customer-service dashboard routes.
 */

const express = require("express");

const { db } = require("../../cloudbase");
const { listCollection, normalizeDoc } = require("../../init-db");
const { webSocketHub } = require("../websocket");

const router = express.Router();

function getDocId(doc) {
  return doc?.id || doc?._id || "";
}

function getOpenId(doc) {
  return doc?.openid || doc?.open_id || "";
}

function getDisplayName(user, fallback = "未知用户") {
  return user?.nickname || user?.username || user?.account || getOpenId(user) || fallback;
}

function toTimestamp(value) {
  if (value instanceof Date) {
    return value.getTime();
  }

  const numeric = Number(value || 0);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric;
  }

  const parsed = Date.parse(String(value || ""));
  if (Number.isFinite(parsed)) {
    return parsed;
  }

  return 0;
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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

function normalizeConversationServiceStatus(conversation) {
  return String(conversation?.service_status || "").trim() || "open";
}

function normalizeListingStatus(listing) {
  const raw = String(listing?.status || "").trim();
  if (raw === "removed") {
    return "off_shelf";
  }
  return raw || "pending_review";
}

function normalizeSingleDoc(input) {
  if (Array.isArray(input)) {
    return input.length ? normalizeDoc(input[0]) : null;
  }

  if (!input || typeof input !== "object") {
    return null;
  }

  return normalizeDoc(input);
}

function buildConversationViewModel(conversation, userMaps, listingMap, districtMap) {
  const listing = listingMap.get(conversation.listing_id);
  const buyer = resolveUser(conversation.buyer_openid, userMaps);
  const seller = resolveUser(conversation.seller_openid, userMaps);
  const district = districtMap.get(listing?.district_code);
  const serviceStatus = normalizeConversationServiceStatus(conversation);
  const lastActiveAt = toTimestamp(conversation.updated_at || conversation.created_at);

  return {
    ...conversation,
    id: getDocId(conversation),
    route_id: conversation?._id || getDocId(conversation),
    service_status: serviceStatus,
    listing,
    listing_title: listing?.title || "商品已删除",
    listing_type: listing?.listing_type || "sale",
    listing_status: normalizeListingStatus(listing),
    listing_image: Array.isArray(listing?.image_urls) ? listing.image_urls[0] || "" : "",
    listing_price: Number(listing?.price || 0),
    district_name: district?.name || listing?.district_name || listing?.district_code || "-",
    buyer,
    buyer_name: getDisplayName(buyer, "买家"),
    seller,
    seller_name: getDisplayName(seller, "卖家"),
    last_message_preview: conversation.last_message || "还没有消息",
    last_active_at: lastActiveAt,
    last_active_label: new Date(lastActiveAt || Date.now()).toLocaleString("zh-CN"),
    is_processed: serviceStatus === "processed",
  };
}

async function recordServiceAction(req, targetType, targetId, action, note = "") {
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
    console.error("Failed to record service action:", error.message);
  }
}

async function loadServiceCollections() {
  const [users, listings, conversations, messages, feedbacks, districts] = await Promise.all([
    listCollection("users", 400),
    listCollection("listings", 400),
    listCollection("conversations", 500),
    listCollection("messages", 1000),
    listCollection("feedback", 300),
    listCollection("districts", 400),
  ]);

  return {
    users,
    userMaps: buildUserMaps(users),
    listingMap: new Map(listings.map((listing) => [getDocId(listing), listing])),
    districtMap: new Map(districts.map((item) => [item.code, item])),
    conversations,
    messages,
    feedbacks,
  };
}

async function findConversationByAnyId(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return null;
  }

  try {
    const result = await db.collection("conversations").where({ id: normalized }).limit(1).get();
    const matched = normalizeSingleDoc(result?.data);
    if (matched) {
      return matched;
    }
  } catch (error) {
    // Fallback to direct document lookup below.
  }

  try {
    const raw = await db.collection("conversations").doc(normalized).get();
    const parsed = normalizeSingleDoc(raw?.data);
    if (parsed) {
      return parsed;
    }
  } catch (error) {
    // Fallback to manual lookup below.
  }

  const conversations = await listCollection("conversations", 500);
  return (
    conversations.find((item) => {
      const ids = [item._id, item.id, getDocId(item)].filter(Boolean).map((entry) => String(entry));
      return ids.includes(normalized);
    }) || null
  );
}

async function listConversationMessages(conversation) {
  const ids = Array.from(
    new Set([conversation?._id, conversation?.id, getDocId(conversation)].filter(Boolean)),
  );
  if (!ids.length) {
    return [];
  }

  const command = db.command;
  const result = await db
    .collection("messages")
    .where({ conversation_id: command.in(ids) })
    .limit(500)
    .get();

  return (result.data || [])
    .map(normalizeDoc)
    .sort((left, right) => toTimestamp(left.created_at) - toTimestamp(right.created_at));
}

function buildMessageViewModel(message, conversationVm, userMaps, currentUser) {
  const senderOpenid = String(message?.sender_openid || "").trim();
  const sender = resolveUser(senderOpenid, userMaps);
  const currentOpenid = String(currentUser?.openid || "").trim();
  const isServiceSender =
    senderOpenid === currentOpenid ||
    senderOpenid === conversationVm.service_sender_openid ||
    senderOpenid === `service-${currentUser?.id || ""}`;

  return {
    ...message,
    id: getDocId(message),
    sender_openid: senderOpenid,
    sender_name: isServiceSender
      ? currentUser?.nickname || "客服"
      : senderOpenid === conversationVm.buyer_openid
        ? conversationVm.buyer_name
        : senderOpenid === conversationVm.seller_openid
          ? conversationVm.seller_name
          : getDisplayName(sender, "平台消息"),
    is_service_sender: isServiceSender,
    is_image:
      String(message?.message_type || "text") === "image" &&
      Boolean(String(message?.image_url || message?.content || "").trim()),
    image_url: String(message?.image_url || message?.content || "").trim(),
  };
}

router.get("/dashboard", async (req, res) => {
  try {
    const currentServiceStatus = String(req.query.service_status || "all").trim() || "all";
    const currentListingStatus = String(req.query.listing_status || "all").trim() || "all";
    const keyword = String(req.query.keyword || "").trim().toLowerCase();
    const { userMaps, listingMap, districtMap, conversations, messages, feedbacks } =
      await loadServiceCollections();

    const recentConversations = conversations
      .map((conversation) => buildConversationViewModel(conversation, userMaps, listingMap, districtMap))
      .filter((conversation) => {
        if (currentServiceStatus !== "all") {
          const expectedStatus = currentServiceStatus === "processed" ? "processed" : "open";
          if (conversation.service_status !== expectedStatus) {
            return false;
          }
        }

        if (currentListingStatus !== "all" && conversation.listing_status !== currentListingStatus) {
          return false;
        }

        if (!keyword) {
          return true;
        }

        const haystack = [
          conversation.listing_title,
          conversation.buyer_name,
          conversation.seller_name,
          conversation.buyer_openid,
          conversation.seller_openid,
          conversation.last_message_preview,
          conversation.district_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(keyword);
      })
      .sort((left, right) => toTimestamp(right.last_active_at) - toTimestamp(left.last_active_at));

    const pendingFeedbacks = feedbacks
      .map((feedback) => ({
        ...feedback,
        user: resolveUser(feedback.user_id || feedback.openid || feedback.open_id, userMaps),
      }))
      .filter((feedback) => feedback.status !== "closed")
      .sort((left, right) => toTimestamp(right.created_at) - toTimestamp(left.created_at))
      .slice(0, 10);

    const stats = {
      conversationCount: recentConversations.length,
      messageCount: messages.length,
      processingConversationCount: recentConversations.filter((item) => !item.is_processed).length,
      pendingFeedbackCount: feedbacks.filter((item) => item.status !== "closed").length,
    };

    res.render("service/dashboard", {
      title: "客服工作台",
      stats,
      recentConversations,
      pendingFeedbacks,
      currentServiceStatus,
      currentListingStatus,
      keyword,
      serviceStatusOptions: [
        { value: "all", label: "全部对话" },
        { value: "open", label: "未处理" },
        { value: "processed", label: "已处理" },
      ],
      listingStatusOptions: [
        { value: "all", label: "全部商品状态" },
        { value: "approved", label: "未下架" },
        { value: "off_shelf", label: "已下架" },
        { value: "pending_review", label: "待审核" },
      ],
    });
  } catch (error) {
    console.error("Failed to load service dashboard:", error);
    req.flash("error", "客服工作台加载失败。");
    res.redirect("/");
  }
});

router.get("/conversations/:id", async (req, res) => {
  try {
    const conversation = await findConversationByAnyId(req.params.id);
    if (!conversation) {
      req.flash("error", "会话不存在。");
      return res.redirect("/service/dashboard");
    }

    const { users, userMaps, listingMap, districtMap } = await loadServiceCollections();
    const conversationVm = buildConversationViewModel(conversation, userMaps, listingMap, districtMap);
    const messages = await listConversationMessages(conversation);
    const messageItems = messages.map((message) =>
      buildMessageViewModel(message, conversationVm, userMaps, req.session.user),
    );

    res.render("service/conversation", {
      title: "客服对话处理",
      conversation: conversationVm,
      messages: messageItems,
      currentServiceUser: req.session.user,
      userCount: users.length,
    });
  } catch (error) {
    console.error("Failed to load service conversation:", error);
    req.flash("error", "会话详情加载失败。");
    res.redirect("/service/dashboard");
  }
});

router.post("/conversations/:id/messages", async (req, res) => {
  try {
    const conversation = await findConversationByAnyId(req.params.id);
    if (!conversation) {
      req.flash("error", "会话不存在。");
      return res.redirect("/service/dashboard");
    }

    const content = String(req.body.content || "").trim();
    if (!content) {
      req.flash("error", "回复内容不能为空。");
      return res.redirect(`/service/conversations/${encodeURIComponent(req.params.id)}`);
    }

    const now = Date.now();
    const senderOpenid = String(req.session.user?.openid || "").trim() || `service-${req.session.user?.id || "staff"}`;
    const payload = {
      id: createId("message"),
      conversation_id: getDocId(conversation),
      sender_openid: senderOpenid,
      content,
      message_type: "text",
      status: "sent",
      created_at: now,
    };

    const addResult = await db.collection("messages").add(payload);
    await db.collection("conversations").doc(conversation._id).update({
      last_message: content,
      unread_count: Number(conversation.unread_count || 0) + 1,
      updated_at: now,
      service_status: "open",
      service_sender_openid: senderOpenid,
      service_updated_at: now,
    });

    webSocketHub.notifyConversationParticipants(conversation, {
      type: "message:new",
      data: {
        conversation_id: getDocId(conversation),
        message: {
          ...payload,
          id: addResult.id,
        },
      },
    });

    await recordServiceAction(
      req,
      "conversation",
      getDocId(conversation),
      "service_reply_message",
      content.slice(0, 80),
    );
    req.flash("success", "客服回复已发送。");
    return res.redirect(`/service/conversations/${encodeURIComponent(req.params.id)}`);
  } catch (error) {
    console.error("Failed to send service message:", error);
    req.flash("error", "发送客服回复失败。");
    return res.redirect(`/service/conversations/${encodeURIComponent(req.params.id)}`);
  }
});

router.post("/conversations/:id/processed", async (req, res) => {
  try {
    const conversation = await findConversationByAnyId(req.params.id);
    if (!conversation) {
      req.flash("error", "会话不存在。");
      return res.redirect("/service/dashboard");
    }

    const nextStatus =
      normalizeConversationServiceStatus(conversation) === "processed" ? "open" : "processed";
    const now = Date.now();

    await db.collection("conversations").doc(conversation._id).update({
      service_status: nextStatus,
      service_processed_at: nextStatus === "processed" ? now : 0,
      service_processed_by: req.session.user?.id || "",
      service_updated_at: now,
    });

    await recordServiceAction(
      req,
      "conversation",
      getDocId(conversation),
      "service_mark_processed",
      nextStatus,
    );
    req.flash("success", nextStatus === "processed" ? "该对话已标记为已处理。" : "该对话已恢复为处理中。");

    const backTo = String(req.body.back_to || "").trim();
    if (backTo === "detail") {
      return res.redirect(`/service/conversations/${encodeURIComponent(req.params.id)}`);
    }
    return res.redirect("/service/dashboard");
  } catch (error) {
    console.error("Failed to update service conversation status:", error);
    req.flash("error", "更新处理状态失败。");
    return res.redirect("/service/dashboard");
  }
});

router.post("/conversations/:id/refund", async (req, res) => {
  try {
    const conversation = await findConversationByAnyId(req.params.id);
    if (!conversation) {
      req.flash("error", "浼氳瘽涓嶅瓨鍦ㄣ€?");
      return res.redirect("/service/dashboard");
    }

    await recordServiceAction(
      req,
      "conversation",
      getDocId(conversation),
      "service_refund_reserved",
      "refund_placeholder",
    );
    req.flash("success", "已预留退款接口按钮，当前先记录动作，后续可直接接入真实退款流程。");

    const backTo = String(req.body.back_to || "").trim();
    if (backTo === "detail") {
      return res.redirect(`/service/conversations/${encodeURIComponent(req.params.id)}`);
    }
    return res.redirect("/service/dashboard");
  } catch (error) {
    console.error("Failed to trigger reserved refund action:", error);
    req.flash("error", "退款预留接口触发失败。");
    return res.redirect(`/service/conversations/${encodeURIComponent(req.params.id)}`);
  }
});

router.post("/conversations/:id/reject", async (req, res) => {
  try {
    const conversation = await findConversationByAnyId(req.params.id);
    if (!conversation) {
      req.flash("error", "浼氳瘽涓嶅瓨鍦ㄣ€?");
      return res.redirect("/service/dashboard");
    }

    await recordServiceAction(
      req,
      "conversation",
      getDocId(conversation),
      "service_reject_reserved",
      "reject_placeholder",
    );
    req.flash("success", "已预留不批准接口按钮，当前先记录动作，后续可直接接入真实不批准流程。");

    const backTo = String(req.body.back_to || "").trim();
    if (backTo === "detail") {
      return res.redirect(`/service/conversations/${encodeURIComponent(req.params.id)}`);
    }
    return res.redirect("/service/dashboard");
  } catch (error) {
    console.error("Failed to trigger reserved reject action:", error);
    req.flash("error", "不批准预留接口触发失败。");
    return res.redirect(`/service/conversations/${encodeURIComponent(req.params.id)}`);
  }
});

router.get("/feedback/:id", async (req, res) => {
  try {
    const feedbackId = req.params.id;
    const [feedbacks, users] = await Promise.all([listCollection("feedback", 200), listCollection("users", 400)]);
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

    await recordServiceAction(req, "feedback", feedbackId, "service_update_status", status);
    req.flash("success", "反馈状态已更新。");
    res.redirect(`/service/feedback/${feedbackId}`);
  } catch (error) {
    console.error("Failed to update feedback in service web:", error);
    req.flash("error", "状态更新失败。");
    res.redirect(`/service/feedback/${feedbackId}`);
  }
});

module.exports = router;
