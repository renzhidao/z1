
// P1 Kernel Globals
interface Window {
  state: any;
  ui: any;
  app: any;
  util: any;
  db: any;
  p2p: any;
  mqtt: any;
  protocol: any;
  hub: any;
  smartCore: any;
  config: any;
  monitor: any;
  uiEvents: any;
  virtualFiles: Map<string, any>;
  smartMetaCache: Map<string, any>;
  remoteFiles: Map<string, any>;
  activeTasks: Map<string, any>;
  logSystem: any;
  // External Libs
  Paho: any;
  Peer: any;
}
