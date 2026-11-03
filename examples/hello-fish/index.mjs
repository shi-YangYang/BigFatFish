import { servePlugin } from './host.mjs';
servePlugin({tools:{greet:async(args,{host,signal})=>{signal.throwIfAborted();await host('events.emit',{name:'greeted'});return {greeting:`你好，${args.name}，鱼正在使用独立插件。`};}}});
