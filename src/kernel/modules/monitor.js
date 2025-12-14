
export function init() {
    console.log('📦 加载模块: Monitor (Console Mode)');
    
    // 移除了 DOM 操作，改为纯控制台记录，React 版将重写 UI
    window.monitor = {
        logs: [],
        
        log(level, module, msg, data) {
            const entry = { ts: new Date(), level, module, msg, data };
            this.logs.push(entry);
            if (this.logs.length > 500) this.logs.shift();
            
            // 控制台保留原生对象
            if (level === 'ERROR' || level === 'FATAL') console.error(`[${module}] ${msg}`, data);
            else console.log(`[${module}] ${msg}`);
        },
        
        info(mod, msg, d) { this.log('INFO', mod, msg, d); },
        warn(mod, msg, d) { this.log('WARN', mod, msg, d); },
        error(mod, msg, d) { this.log('ERROR', mod, msg, d); },
        fatal(mod, msg, d) { this.log('FATAL', mod, msg, d); },
        
        show() {
           console.table(this.logs);
        },
        
        updateStats() {
           // No-op in console mode
        },
        
        appendLine(e) {
           // No-op
        }
    };
    
    // setInterval(() => window.monitor.updateStats(), 2000);
}
