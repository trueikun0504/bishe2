const EnhancedMessageDetailPage = {
  setup() {
    const route = useRoute();
    const router = useRouter();
    const loading = ref(false);
    const errorText = ref("");
    const detail = ref(null);
    const messages = ref([]);
    const inputText = ref("");
    const sending = ref(false);
    const panelRef = ref(null);
    const uploadInputRef = ref(null);
    const composerHint = ref("");
    const composerError = ref("");
    const pendingComposerImages = ref([]);
    const activePreviewUrl = ref("");
    const canSend = computed(() => Boolean(String(inputText.value || "").trim() || pendingComposerImages.value.length));
    const myName = computed(() => getUserDisplayName(appState.user));
    const peerName = computed(() => detail.value?.peer_nickname || "对方");

    let socketRef = null;
    let reconnectTimer = 0;
    let activeConversationId = "";
    let hintTimer = 0;
    const objectUrls = new Set();

    function revokePreviewUrl(url) {
      if (url) {
        URL.revokeObjectURL(url);
        objectUrls.delete(url);
      }
    }

    function setComposerMessage(message, type = "hint") {
      if (hintTimer) {
        window.clearTimeout(hintTimer);
        hintTimer = 0;
      }
      composerError.value = type === "error" ? String(message || "") : "";
      composerHint.value = type === "error" ? "" : String(message || "");
      if (composerHint.value) {
        hintTimer = window.setTimeout(() => {
          composerHint.value = "";
          hintTimer = 0;
        }, 2400);
      }
    }

    function clearComposerError() {
      composerError.value = "";
    }

    async function scrollToBottom() {
      await nextTick();
      if (panelRef.value) {
        panelRef.value.scrollTop = panelRef.value.scrollHeight;
      }
    }

    function normalizeImageUrl(raw) {
      const value = String(raw || "").trim();
      if (!value) return "";
      if (/^https?:\/\//i.test(value) || value.startsWith("blob:")) return value;
      return value.startsWith("/") ? value : `/${value}`;
    }

    function normalizeImageFile(file) {
      if (!file) return null;
      const lowerName = String(file.name || "").toLowerCase();
      const normalizedType =
        file.type ||
        (lowerName.endsWith(".png")
          ? "image/png"
          : lowerName.endsWith(".webp")
            ? "image/webp"
            : lowerName.endsWith(".jpg") ||
                lowerName.endsWith(".jpeg") ||
                lowerName.endsWith(".jfif") ||
                lowerName.endsWith(".pjp")
              ? "image/jpeg"
              : "");

      if (!normalizedType || normalizedType === file.type) {
        return file;
      }

      return new File([file], file.name || `chat-${Date.now()}`, {
        type: normalizedType,
        lastModified: file.lastModified || Date.now(),
      });
    }

    function validateImageFile(file) {
      if (!file) {
        throw new Error("请选择图片后再发送。");
      }
      const allowedTypes = ["image/jpeg", "image/jpg", "image/pjpeg", "image/png", "image/webp"];
      const lowerName = String(file.name || "").toLowerCase();
      const allowedByExtension =
        lowerName.endsWith(".jpg") ||
        lowerName.endsWith(".jpeg") ||
        lowerName.endsWith(".jfif") ||
        lowerName.endsWith(".pjp") ||
        lowerName.endsWith(".png") ||
        lowerName.endsWith(".webp");

      if (!allowedTypes.includes(file.type) && !allowedByExtension) {
        throw new Error("仅支持 jpg、png、webp 图片。");
      }
      if (file.size > 10 * 1024 * 1024) {
        throw new Error("图片不能超过 10MB。");
      }
    }

    function getMessageKey(message, index) {
      return message?.id || message?.local_id || `${message?.created_at || 0}-${index}`;
    }

    function getMessageImageUrl(message) {
      if (!message) return "";
      return normalizeImageUrl(message.image_url || message.preview_url || message.content || "");
    }

    function isImageMessage(message) {
      return String(message?.message_type || "text") === "image" && Boolean(getMessageImageUrl(message));
    }

    function canPreviewImage(message) {
      return Boolean(getMessageImageUrl(message));
    }

    function hasMessage(messageId) {
      return Boolean(messageId) && messages.value.some((item) => item.id === messageId);
    }

    function upsertMessage(message) {
      const index = messages.value.findIndex((item) => item.id && item.id === message.id);
      if (index === -1) {
        messages.value.push(message);
      } else {
        messages.value.splice(index, 1, { ...messages.value[index], ...message });
      }
    }

    function removeLocalMessage(localId) {
      const index = messages.value.findIndex((item) => item.local_id === localId);
      if (index !== -1) {
        const [removed] = messages.value.splice(index, 1);
        revokePreviewUrl(removed?.preview_url);
      }
    }

    function updateLocalMessage(localId, patch) {
      const index = messages.value.findIndex((item) => item.local_id === localId);
      if (index !== -1) {
        messages.value.splice(index, 1, { ...messages.value[index], ...patch });
      }
    }

    function cleanupPendingPreview(message) {
      if (message?.preview_url) {
        revokePreviewUrl(message.preview_url);
      }
    }

    function updateOwnMessageStatus(status) {
      messages.value = messages.value.map((message) =>
        message.sender_openid === appState.user?.openid && String(message.message_type || "text") !== "image"
          ? { ...message, status }
          : message,
      );
    }

    function clearPendingComposerImages() {
      pendingComposerImages.value.forEach((item) => revokePreviewUrl(item.preview_url));
      pendingComposerImages.value = [];
    }

    function removePendingComposerImage(imageId) {
      const index = pendingComposerImages.value.findIndex((item) => item.id === imageId);
      if (index === -1) return;
      const [removed] = pendingComposerImages.value.splice(index, 1);
      revokePreviewUrl(removed?.preview_url);
    }

    function queueComposerFiles(fileList, source = "picker") {
      const files = Array.from(fileList || [])
        .map((file) => normalizeImageFile(file))
        .filter(Boolean);

      if (!files.length) {
        return;
      }

      clearComposerError();
      const remain = 9 - pendingComposerImages.value.length;
      if (remain <= 0) {
        setComposerMessage("最多再发 9 张图片。", "error");
        return;
      }

      const acceptedFiles = files.slice(0, remain);
      let addedCount = 0;
      acceptedFiles.forEach((file) => {
        validateImageFile(file);
        const duplicate = pendingComposerImages.value.some(
          (item) =>
            item.file.name === file.name &&
            item.file.size === file.size &&
            item.file.lastModified === file.lastModified,
        );
        if (duplicate) return;
        const previewUrl = URL.createObjectURL(file);
        objectUrls.add(previewUrl);
        pendingComposerImages.value.push({
          id: `composer-image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          source,
          preview_url: previewUrl,
          name: file.name || "image",
        });
        addedCount += 1;
      });

      if (addedCount > 0) {
        const sourceText = source === "paste" ? "已粘贴" : source === "capture" ? "已截图" : "已选择";
        setComposerMessage(`${sourceText} ${addedCount} 张图片，按 Enter 或点击发送后上传。`);
      }
    }

    function buildPendingImageMessage(file) {
      const previewUrl = URL.createObjectURL(file);
      objectUrls.add(previewUrl);
      return {
        local_id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        id: "",
        sender_openid: appState.user?.openid || "",
        content: "",
        message_type: "image",
        image_url: "",
        preview_url: previewUrl,
        created_at: Date.now(),
        local_status: "uploading",
        local_error: "",
      };
    }

    async function sendMessagePayload(body) {
      return apiRequest(`/api/web/conversations/${encodeURIComponent(detail.value.id)}/messages`, {
        method: "POST",
        body,
      });
    }

    async function uploadChatImage(file) {
      const formData = new FormData();
      formData.append("image", file, file.name || `image-${Date.now()}.png`);
      return apiRequest("/api/web/uploads/chat", {
        method: "POST",
        body: formData,
      });
    }

    async function sendImageFile(file, options = {}) {
      const manageSending = options.manageSending !== false;
      if (!detail.value || (manageSending && sending.value)) {
        return false;
      }

      validateImageFile(file);
      clearComposerError();
      setComposerMessage("图片上传中...");
      if (manageSending) {
        sending.value = true;
      }
      const pending = buildPendingImageMessage(file);
      messages.value.push(pending);
      await scrollToBottom();

      try {
        const uploaded = await uploadChatImage(file);
        const created = await sendMessagePayload({
          message_type: "image",
          image_url: normalizeImageUrl(uploaded?.url || ""),
          content: "",
        });
        cleanupPendingPreview(pending);
        if (hasMessage(created.id)) {
          removeLocalMessage(pending.local_id);
        } else {
          updateLocalMessage(pending.local_id, {
            ...created,
            preview_url: "",
            local_status: "sent",
            local_error: "",
          });
        }
        setComposerMessage("图片已发送。");
        await scrollToBottom();
        return true;
      } catch (error) {
        updateLocalMessage(pending.local_id, {
          local_status: "failed",
          local_error: error.message || "发送失败，请重试。",
        });
        setComposerMessage(error.message || "图片发送失败，请重试。", "error");
        return false;
      } finally {
        if (manageSending) {
          sending.value = false;
        }
      }
    }

    async function markConversationRead() {
      if (!detail.value?.id) return;
      try {
        await apiRequest(`/api/web/conversations/${encodeURIComponent(detail.value.id)}/read`, {
          method: "POST",
          body: {},
        });
      } catch (error) {
        console.warn("[chat-ws] mark read failed:", error.message || error);
      }
    }

    function getConversationSocketIds() {
      if (!detail.value?.id) return [];
      return [String(detail.value.id)];
    }

    function clearReconnectTimer() {
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = 0;
      }
    }

    function cleanupSocket() {
      clearReconnectTimer();
      if (socketRef) {
        const closingSocket = socketRef;
        socketRef = null;
        closingSocket.onopen = null;
        closingSocket.onmessage = null;
        closingSocket.onerror = null;
        closingSocket.onclose = null;
        if (
          closingSocket.readyState === window.WebSocket.OPEN ||
          closingSocket.readyState === window.WebSocket.CONNECTING
        ) {
          closingSocket.close();
        }
      }
    }

    function subscribeCurrentConversation() {
      if (!socketRef || socketRef.readyState !== window.WebSocket.OPEN) return;
      getConversationSocketIds().forEach((conversationId) => {
        socketRef.send(JSON.stringify({ type: "subscribe", conversationId }));
      });
    }

    function scheduleReconnect() {
      if (!detail.value?.id || !appState.token) return;
      clearReconnectTimer();
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = 0;
        connectSocket();
      }, 2500);
    }

    function handleSocketPayload(payload) {
      if (!payload || typeof payload !== "object") return;

      if (payload.type === "auth:success") {
        subscribeCurrentConversation();
        return;
      }

      if (payload.type === "message:new") {
        const message = payload.data?.message || null;
        const conversationId = String(payload.data?.conversation_id || "");
        if (!message || !getConversationSocketIds().includes(conversationId)) {
          return;
        }
        if (message.sender_openid === appState.user?.openid) {
          return;
        }
        if (!hasMessage(message.id)) {
          upsertMessage(message);
          scrollToBottom();
        }
        markConversationRead();
        return;
      }

      if (payload.type === "conversation:read") {
        const conversationId = String(payload.data?.conversation_id || "");
        if (!getConversationSocketIds().includes(conversationId)) {
          return;
        }
        if (payload.data?.reader_openid && payload.data.reader_openid !== appState.user?.openid) {
          updateOwnMessageStatus("read");
        }
      }
    }

    function connectSocket() {
      if (!detail.value?.id || !appState.token || !window.WebSocket) return;
      const nextConversationId = String(detail.value.id);
      if (
        socketRef &&
        socketRef.readyState === window.WebSocket.OPEN &&
        activeConversationId === nextConversationId
      ) {
        subscribeCurrentConversation();
        return;
      }

      cleanupSocket();
      activeConversationId = nextConversationId;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const socketUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(appState.token)}`;
      const socket = new window.WebSocket(socketUrl);
      socketRef = socket;

      socket.onmessage = (event) => {
        const payload = safeJsonParse(String(event.data || ""));
        handleSocketPayload(payload);
      };
      socket.onopen = () => {
        subscribeCurrentConversation();
      };
      socket.onerror = () => {};
      socket.onclose = () => {
        if (socketRef === socket) {
          socketRef = null;
        }
        scheduleReconnect();
      };
    }

    async function loadData() {
      loading.value = true;
      errorText.value = "";
      try {
        const conversationId = encodeURIComponent(route.params.id);
        const [conversation, list] = await Promise.all([
          apiRequest(`/api/web/conversations/${conversationId}`),
          apiRequest(`/api/web/conversations/${conversationId}/messages`),
        ]);
        detail.value = conversation;
        messages.value = Array.isArray(list) ? list : [];
        await markConversationRead();
        connectSocket();
        await scrollToBottom();
      } catch (error) {
        errorText.value = error.message || "加载聊天详情失败，请稍后重试。";
      } finally {
        loading.value = false;
      }
    }

    function isMine(message) {
      return message?.sender_openid === appState.user?.openid;
    }

    async function sendMessage() {
      const content = String(inputText.value || "").trim();
      const composerImages = [...pendingComposerImages.value];
      if ((!content && !composerImages.length) || !detail.value || sending.value) {
        return;
      }

      clearComposerError();
      sending.value = true;
      try {
        if (content) {
          const created = await sendMessagePayload({ content });
          if (!hasMessage(created.id)) {
            messages.value.push(created);
          }
          inputText.value = "";
        }

        if (composerImages.length) {
          const sentImageIds = [];
          for (const imageItem of composerImages) {
            const imageSent = await sendImageFile(imageItem.file, { manageSending: false });
            if (!imageSent) {
              break;
            }
            sentImageIds.push(imageItem.id);
          }
          sentImageIds.forEach((imageId) => removePendingComposerImage(imageId));
        }

        setComposerMessage("");
        await scrollToBottom();
      } catch (error) {
        setComposerMessage(error.message || "发送失败，请重试。", "error");
      } finally {
        sending.value = false;
      }
    }

    async function captureScreenshot() {
      if (sending.value) return;
      if (!navigator.mediaDevices?.getDisplayMedia) {
        setComposerMessage("当前浏览器不支持截图授权，请直接 Ctrl+V 粘贴截图。", "error");
        return;
      }

      let stream;
      try {
        setComposerMessage("请在浏览器授权后选择要截取的窗口或屏幕...");
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        const track = stream.getVideoTracks()[0];
        if (!track) {
          throw new Error("没有获取到屏幕画面。");
        }

        let blob = null;
        if (typeof ImageCapture !== "undefined") {
          const imageCapture = new ImageCapture(track);
          const bitmap = await imageCapture.grabFrame();
          const canvas = document.createElement("canvas");
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const context = canvas.getContext("2d");
          context.drawImage(bitmap, 0, 0);
          blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
        } else {
          const video = document.createElement("video");
          video.srcObject = stream;
          video.muted = true;
          await video.play();
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const context = canvas.getContext("2d");
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
          video.pause();
          video.srcObject = null;
        }

        if (!blob) {
          throw new Error("截图生成失败，请重试。");
        }

        const file = new File([blob], `screencapture-${Date.now()}.png`, { type: "image/png" });
        queueComposerFiles([file], "capture");
      } catch (error) {
        const isAbort = error?.name === "NotAllowedError" || error?.name === "AbortError";
        setComposerMessage(
          isAbort
            ? "截图未授权，你也可以直接 Ctrl+V 粘贴截图发送。"
            : error.message || "截图失败，请改用粘贴图片。",
          "error",
        );
      } finally {
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }
      }
    }

    async function handlePaste(event) {
      const clipboardItems = Array.from(event?.clipboardData?.items || []);
      const imageItems = clipboardItems.filter((item) => item.type && item.type.startsWith("image/"));
      if (!imageItems.length) return;

      event.preventDefault();
      try {
        const files = imageItems.map((item) => normalizeImageFile(item.getAsFile())).filter(Boolean);
        if (!files.length) {
          throw new Error("剪贴板图片读取失败，请重试。");
        }
        queueComposerFiles(files, "paste");
      } catch (error) {
        setComposerMessage(error.message || "粘贴图片失败，请重试。", "error");
      }
    }

    function handleEnterSend(event) {
      if (event && (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || event.isComposing)) {
        return;
      }
      event?.preventDefault();
      requestSend("enter");
    }

    function requestSend() {
      sendMessage();
    }

    function openListing() {
      if (detail.value?.listing?.id) {
        router.push(`/listing/${encodeURIComponent(detail.value.listing.id)}`);
      }
    }

    function placeOrder() {
      window.alert("担保支付入口已预留，当前版本先保留购买按钮位置。");
    }

    function useTool(label) {
      if (label === "图片") {
        if (uploadInputRef.value) {
          uploadInputRef.value.value = "";
          uploadInputRef.value.click();
        }
        return;
      }
      if (label === "截图") {
        captureScreenshot();
        return;
      }
      window.alert(`${label} 功能暂未接入，当前先保留入口位置。`);
    }

    function openImagePreview(message) {
      const imageUrl = getMessageImageUrl(message);
      if (!imageUrl) return;
      activePreviewUrl.value = imageUrl;
    }

    function closeImagePreview() {
      activePreviewUrl.value = "";
    }

    function retryImageMessage() {
      setComposerMessage("失败图片请重新选择后发送。", "error");
    }

    function handleImageSelection(event) {
      queueComposerFiles(event?.target?.files || [], "picker");
      if (event?.target) {
        event.target.value = "";
      }
    }

    onMounted(loadData);
    watch(
      () => route.params.id,
      (nextId, previousId) => {
        if (nextId && nextId !== previousId) {
          cleanupSocket();
          activeConversationId = "";
          clearPendingComposerImages();
          loadData();
        }
      },
    );
    onBeforeUnmount(() => {
      clearPendingComposerImages();
      cleanupSocket();
      if (hintTimer) {
        window.clearTimeout(hintTimer);
      }
      Array.from(objectUrls).forEach((url) => revokePreviewUrl(url));
    });

    return {
      activePreviewUrl,
      canPreviewImage,
      canSend,
      closeImagePreview,
      clearComposerError,
      composerError,
      composerHint,
      detail,
      errorText,
      formatDateTime,
      formatPrice,
      getAvatarText,
      getMessageImageUrl,
      getMessageKey,
      handleEnterSend,
      handleImageSelection,
      handlePaste,
      inputText,
      isImageMessage,
      isMine,
      loading,
      messages,
      myName,
      openImagePreview,
      openListing,
      panelRef,
      pendingComposerImages,
      peerName,
      placeOrder,
      removePendingComposerImage,
      requestSend,
      retryImageMessage,
      sending,
      uploadInputRef,
      useTool,
    };
  },
  template: `
    <section v-if="loading" class="card section muted">正在加载聊天...</section>
    <section v-else-if="errorText" class="card section error">{{ errorText }}</section>
    <section v-else-if="detail" class="chat-shell">
      <header class="chat-topbar card">
        <div class="chat-peer">
          <div class="chat-peer-avatar">{{ getAvatarText(peerName) }}</div>
          <div><h1>{{ peerName }}</h1><p>{{ detail.peer_openid || '本地社区用户' }}</p></div>
        </div>
        <button class="btn btn-ghost" @click="placeOrder">立即购买</button>
      </header>

      <section class="chat-product-bar card">
        <div class="chat-product-info" @click="openListing">
          <img v-if="detail.listing && detail.listing.image_urls && detail.listing.image_urls[0]" class="chat-product-image" :src="detail.listing.image_urls[0]" alt="" />
          <div v-else class="chat-product-image chat-product-image-empty">无图</div>
          <div>
            <div class="chat-product-title">{{ detail.listing?.title || '商品已下架' }}</div>
            <div class="chat-product-price">{{ formatPrice(detail.listing?.price || 0) }}</div>
            <div class="chat-product-note">交易前先聊清区县、成色与见面方式。</div>
          </div>
        </div>
      </section>

      <section ref="panelRef" class="chat-panel card">
        <div class="chat-history">
          <div v-for="(message, index) in messages" :key="getMessageKey(message, index)" class="chat-message-block">
            <div class="chat-message-time">{{ formatDateTime(message.created_at) }}</div>
            <div class="chat-message-row" :class="{ mine: isMine(message) }">
              <div class="chat-avatar" v-if="!isMine(message)">{{ getAvatarText(peerName) }}</div>
              <div class="chat-bubble" :class="{ mine: isMine(message), 'chat-bubble-image': isImageMessage(message) }">
                <template v-if="isImageMessage(message)">
                  <button v-if="canPreviewImage(message)" type="button" class="chat-image-button" @click="openImagePreview(message)">
                    <img class="chat-message-image" :src="getMessageImageUrl(message)" alt="聊天图片" />
                  </button>
                  <div v-else class="chat-image-fallback">图片暂时无法预览</div>
                  <div class="chat-image-meta">
                    <span v-if="message.local_status === 'uploading'" class="chat-message-status">发送中...</span>
                    <span v-else-if="message.local_status === 'failed'" class="chat-message-status chat-message-status-error">{{ message.local_error || '发送失败' }}</span>
                    <span v-else class="chat-message-status">图片</span>
                    <button v-if="message.local_status === 'failed'" type="button" class="chat-message-action" @click="retryImageMessage()">重新选择</button>
                  </div>
                </template>
                <template v-else>{{ message.content || '（空消息）' }}</template>
              </div>
              <div class="chat-avatar mine" v-if="isMine(message)">{{ getAvatarText(myName) }}</div>
            </div>
          </div>
        </div>
      </section>

      <footer class="chat-composer card">
        <div class="chat-tool-row">
          <button type="button" class="chat-tool" :disabled="sending" @click="useTool('图片')">图片</button>
          <button type="button" class="chat-tool" :disabled="sending" @click="useTool('截图')">截图</button>
          <button type="button" class="chat-tool" @click="useTool('订单')">订单</button>
          <button type="button" class="chat-tool" @click="useTool('位置')">位置</button>
          <input
            ref="uploadInputRef"
            class="chat-upload-input"
            type="file"
            accept="image/jpeg,image/jpg,image/pjpeg,image/png,image/webp,.jpg,.jpeg,.jfif,.pjp,.png,.webp"
            multiple
            @change="handleImageSelection"
          />
        </div>
        <div v-if="composerError || composerHint" class="chat-feedback" :class="{ error: composerError }">
          {{ composerError || composerHint }}
        </div>
        <div v-if="pendingComposerImages.length" class="chat-composer-attachments">
          <div class="chat-composer-attachment-card" v-for="imageItem in pendingComposerImages" :key="imageItem.id">
            <img class="chat-composer-attachment-image" :src="imageItem.preview_url" alt="待发送图片" />
            <div class="chat-composer-attachment-meta">
              <strong>{{ imageItem.source === 'capture' ? '待发送截图' : '待发送图片' }}</strong>
              <span>{{ imageItem.source === 'paste' ? '已粘贴，点击发送后上传' : imageItem.source === 'capture' ? '已截图，点击发送后上传' : '已选择，点击发送后上传' }}</span>
            </div>
            <button type="button" class="chat-composer-attachment-remove" @click="removePendingComposerImage(imageItem.id)">移除</button>
          </div>
        </div>
        <div class="chat-input-row">
          <input
            class="input chat-input"
            v-model="inputText"
            placeholder="输入消息，按 Enter 发送，支持 Ctrl+V 粘贴图片"
            @input="clearComposerError"
            @keydown.enter.prevent="handleEnterSend"
            @paste="handlePaste"
          />
          <button class="btn btn-primary chat-send" :disabled="sending || !canSend" @click="requestSend('button')">{{ sending ? '发送中...' : '发送' }}</button>
        </div>
      </footer>

      <div v-if="activePreviewUrl" class="chat-image-preview-mask" @click="closeImagePreview">
        <div class="chat-image-preview-card" @click.stop>
          <button type="button" class="chat-image-preview-close" @click="closeImagePreview">关闭</button>
          <img class="chat-image-preview-image" :src="activePreviewUrl" alt="聊天图片预览" />
        </div>
      </div>
    </section>
  `,
};
