/** Environment-only art direction. Never modifies gameplay lights or collision data. */
export interface EnvironmentPreset {
  id:string; background:string; nebula:[string,string]; fog:{color:string;density:number}
  starColor:string; metal:string; rock:string; trim:string; lightColor:string
  starCount:number; dustCount:number; objectDensity:number; routeSpeed:number
  landmarks:{id:string;distance:number;side:-1|1;x:number;y:number;kind:'array'|'dock'|'spars'}[]
  planet:{color:string;position:[number,number,number];radius:number;ring:boolean}
}
export const RELAY_GRAVEYARD:EnvironmentPreset={
  id:'relay-graveyard',background:'#050914',nebula:['#253855','#352144'],
  fog:{color:'#080f1c',density:.0018},starColor:'#a8b9cf',metal:'#263847',
  rock:'#172536',trim:'#566175',lightColor:'#92a6bf',starCount:1700,dustCount:72,
  objectDensity:.7,routeSpeed:18,
  landmarks:[
    {id:'fractured-receiver',distance:200,side:1,x:78,y:12,kind:'array'},
    {id:'abandoned-dock',distance:920,side:-1,x:87,y:3,kind:'dock'},
    {id:'outer-signal-spars',distance:1760,side:1,x:96,y:-6,kind:'spars'},
  ],
  planet:{color:'#27364c',position:[-123,57,-315],radius:52,ring:true},
}
export interface EnvironmentPreview {scene:string;speedMultiplier?:number;density?:number;offset?:number}
