import {startRuntime} from '../../dist/runtime/src/lifecycle.js';
import {paths} from '../../dist/runtime/src/paths.js';
import {requestRuntime} from '../../dist/runtime/src/connection.js';
import {douyinFixture} from './douyin.ts';
const [root,video,python]=process.argv.slice(2),fixture=douyinFixture(video),runtime=await startRuntime(paths(root),0,{douyin:fixture.attach});
await requestRuntime(runtime.connection,'/v1/douyin','PUT',{revision:'',enabled:true,headless:true,accountId:'12345',executablePath:'',pythonPath:python});
const task=await requestRuntime(runtime.connection,'/v1/douyin/watch','POST',{videoId:'1234567890123456789',seconds:10,requestId:'crash'});process.send?.({id:task.id});
