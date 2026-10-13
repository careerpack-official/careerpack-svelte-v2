"use client";

import { useEffect } from "react";

type ChatWindow = Window & {
  LiveChatWidget?: { call: (method: "destroy") => void };
  __careerpackChatDestroyed?: boolean;
};

export function LandingLiveChat() {
  useEffect(() => {
    const chatWindow = window as ChatWindow;
    if (window.location.pathname !== "/") return;
    // SPA entry from a private page keeps its CSP; SDK destroy also needs a fresh document.
    const documentPath = new URL(performance.getEntriesByType("navigation")[0]?.name || window.location.href).pathname;
    if (documentPath !== "/" || chatWindow.__careerpackChatDestroyed) {
      window.location.reload();
      return;
    }
    const script = document.createElement("script");
    script.id = "careerpack-livechat";
    script.text = "window.__lc=window.__lc||{};window.__lc.license=19961971;window.__lc.integration_name=\"manual_onboarding\";window.__lc.product_name=\"livechat\";(function(n,t,c){function i(n){return e._h?e._h.apply(null,n):e._q.push(n)}var e={_q:[],_h:null,_v:\"2.0\",on:function(){i([\"on\",c.call(arguments)])},once:function(){i([\"once\",c.call(arguments)])},off:function(){i([\"off\",c.call(arguments)])},get:function(){if(!e._h)throw new Error(\"You can't use getters before load.\");return i([\"get\",c.call(arguments)])},call:function(){i([\"call\",c.call(arguments)])},init:function(){var n=t.createElement(\"script\");n.async=!0;n.type=\"text/javascript\";n.src=\"https://cdn.livechatinc.com/tracking.js\";t.head.appendChild(n)}};!n.__lc.asyncInit&&e.init();n.LiveChatWidget=n.LiveChatWidget||e}(window,document,[].slice));";
    document.body.appendChild(script);
    return () => {
      chatWindow.LiveChatWidget?.call("destroy");
      chatWindow.__careerpackChatDestroyed = true;
      script.remove();
    };
  }, []);

  return (
    <noscript>
      <a href="https://www.livechat.com/chat-with/19961971/" rel="nofollow">Chat with us</a>
      {", powered by "}
      <a href="https://www.livechat.com/?welcome" rel="noopener nofollow" target="_blank">LiveChat</a>
    </noscript>
  );
}
