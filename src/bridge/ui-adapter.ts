
// Bridge: M1 Kernel -> React UI Adapter
// 这个文件将自己伪装成 m1 的 window.ui 对象

export const kernelEvents = new EventTarget();

export function initBridge() {
    console.log('🌉 Bridge: Initializing UI Adapter for Kernel...');
    
    window.ui = {
        init: () => {
            console.log('🌉 Bridge: Kernel requested UI Init');
        },

        // 拦截: 更新联系人列表
        renderList: () => {
            // 触发 React 重新获取联系人数据
            kernelEvents.dispatchEvent(new CustomEvent('KERNEL_CONTACTS_UPDATE'));
        },

        // 拦截: 更新自身状态 (连接数、MQTT状态等)
        updateSelf: () => {
            kernelEvents.dispatchEvent(new CustomEvent('KERNEL_STATUS_UPDATE'));
        },

        // 拦截: 收到新消息
        appendMsg: (msg: any) => {
            // 将消息转发给 React (ChatDetail 组件会监听)
            kernelEvents.dispatchEvent(new CustomEvent('KERNEL_NEW_MSG', { detail: msg }));
        },

        // 拦截: 清空消息 (切换聊天时)
        clearMsgs: () => {
             // React handle this by state, do nothing
        },

        // 拦截: 下载工具
        downloadBlob: (data: any, name: string) => {
            let url = '';
            if (data instanceof Blob) url = URL.createObjectURL(data);
            else if (typeof data === 'string') url = 'data:text/plain;charset=utf-8,' + encodeURIComponent(data);
            else return;
            const a = document.createElement('a');
            a.href = url; a.download = name;
            document.body.appendChild(a); a.click();
            setTimeout(() => document.body.removeChild(a), 100);
        }
    };

    // 伪装 uiEvents，防止报错
    window.uiEvents = {
        init: () => {}
    };

    console.log('🌉 Bridge: Ready');
}
