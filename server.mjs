import http from 'http';
import fs from 'fs';
import { createPublicClient, createWalletClient, http as viemHttp, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
const manifest=(()=>{try{return JSON.parse(fs.readFileSync('manifest.json','utf8'))}catch{return{}}})();
const RPC_URL=process.env.RPC_URL;
const PRIVATE_KEY=process.env.AGENT_PRIVATE_KEY;
const account=PRIVATE_KEY?privateKeyToAccount(PRIVATE_KEY):null;
const isTestnet=RPC_URL&&RPC_URL.includes('testnet');
const chain=isTestnet?{id:97,name:'bscTestnet'}:{id:56,name:'bsc'};
const publicClient=createPublicClient({chain,transport:viemHttp(RPC_URL)});
const walletClient=PRIVATE_KEY?createWalletClient({chain,transport:viemHttp(RPC_URL),account}):null;
const POSITION_MANAGER='0x46A15B0b27311cedF172AB29E4f4766fbE7F4364';
const abi=parseAbi(['function collect(uint256 tokenId,address recipient,uint128 amount0Max,uint128 amount1Max) returns (uint256 amount0,uint256 amount1)']);
function jsonResponse(res,obj){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(obj));}
function errorResponse(res,code,message){res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify({error:message}));}
const server=http.createServer(async (req,res)=>{
if(req.method==='GET'&&req.url==='/health'){jsonResponse(res,{ok:true,agent:manifest.name||null,wallet:account?account.address:null});return;}
if(req.method==='POST'&&req.url===manifest.endpoint){
let body='';req.on('data',c=>{body+=c});req.on('end',async()=>{
let payload;try{payload=JSON.parse(body)}catch(e){errorResponse(res,400,'Invalid JSON');return;}
const {jsonrpc,id,method,params}=payload;
if(jsonrpc!=='2.0'){errorResponse(res,400,'Invalid JSON-RPC');return;}
if(method!=='collectFees'){errorResponse(res,400,'Unsupported method');return;}
const positionId=params?.positionId;
if(!positionId){errorResponse(res,400,'Missing positionId');return;}
try{
const maxUint128=(2n**128n)-1n;
const recipient=account.address;
const txHash=await walletClient.writeContract({address:POSITION_MANAGER,abi,functionName:'collect',args:[BigInt(positionId),recipient,maxUint128,maxUint128]});
jsonResponse(res,{jsonrpc:'2.0',id,result:txHash});
}catch(err){jsonResponse(res,{jsonrpc:'2.0',id,error:{code:-32000,message:err.message}});}
});
return;
}
errorResponse(res,404,'Not found');
});
server.listen(process.env.PORT||3000);