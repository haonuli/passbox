/**
 * Service Worker 入口
 *
 * 消息路由 + 事件监听。
 */
import * as storage from '../lib/storage';
import * as vaultCache from './vault-cache';
import * as autoFill from './auto-fill';
import * as autoSave from './auto-save';
import type { Message, MessageResponse } from '../types';

/** 处理消息并返回响应 */
async function handleMessage(message: Message): Promise<MessageResponse> {
  try {
    switch (message.type) {
      case 'GET_STATUS': {
        const status = await storage.getStatus();
        return { ok: true, data: status };
      }

      case 'LOGIN': {
        await vaultCache.loginAndCache(message.email, message.masterPassword);
        return { ok: true, data: null };
      }

      case 'UNLOCK': {
        await vaultCache.unlockAndCache(message.masterPassword);
        return { ok: true, data: null };
      }

      case 'LOCK': {
        await vaultCache.lock();
        return { ok: true, data: null };
      }

      case 'GET_ITEMS': {
        const items = await vaultCache.getItems(message.query);
        return { ok: true, data: items };
      }

      case 'FILL': {
        const credentials = await autoFill.handleFillRequest(message.domain);
        return { ok: true, data: credentials };
      }

      case 'SAVE_DETECTED': {
        const result = await autoSave.handleSaveDetected(
          message.domain,
          message.username,
          message.password,
        );
        return { ok: true, data: result };
      }

      case 'COPY_PASSWORD': {
        const password = await vaultCache.copyPassword(message.itemId);
        return { ok: true, data: password };
      }

      default: {
        const _exhaustive: never = message;
        return { ok: false, error: `未知消息类型: ${String(_exhaustive)}` };
      }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '未知错误' };
  }
}

// 消息监听
chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  handleMessage(message as Message)
    .then(sendResponse)
    .catch(() => {
      sendResponse({ ok: false, error: '消息处理异常' });
    });
  return true; // 保持消息通道开启以支持异步响应
});

// 安装/更新时初始化状态
chrome.runtime.onInstalled.addListener(() => {
  void storage.setStatus('logged_out');
});

// 每分钟检查一次自动锁定
chrome.alarms.create('passbox-auto-lock', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'passbox-auto-lock') {
    void storage.checkAutoLock();
  }
});
