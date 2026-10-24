import type {InkStroke} from '../shared/notebook';
type Point=readonly [number,number];
function pointDistance(p:Point,a:Point,b:Point){const x=b[0]-a[0],y=b[1]-a[1],length=x*x+y*y,t=length?Math.max(0,Math.min(1,((p[0]-a[0])*x+(p[1]-a[1])*y)/length)):0;return Math.hypot(p[0]-a[0]-t*x,p[1]-a[1]-t*y)}
const cross=(a:Point,b:Point,c:Point)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function segmentDistance(a:Point,b:Point,c:Point,d:Point){
 const abC=cross(a,b,c),abD=cross(a,b,d),cdA=cross(c,d,a),cdB=cross(c,d,b);
 const overlaps=Math.max(Math.min(a[0],b[0]),Math.min(c[0],d[0]))<=Math.min(Math.max(a[0],b[0]),Math.max(c[0],d[0]))&&Math.max(Math.min(a[1],b[1]),Math.min(c[1],d[1]))<=Math.min(Math.max(a[1],b[1]),Math.max(c[1],d[1]));
 if(overlaps&&abC*abD<=0&&cdA*cdB<=0)return 0;
 return Math.min(pointDistance(a,c,d),pointDistance(b,c,d),pointDistance(c,a,b),pointDistance(d,a,b));
}
/** Test a swept eraser in CSS pixels, including fast crossings and single-point ink dots. */
export function strokeHitsEraser(stroke:InkStroke,from:Point,to:Point,width:number,height:number,radius:number){
 const point=(p:Point):Point=>[p[0]/100*width,p[1]/100*height];
 return stroke.points.slice(1).some((p,i)=>segmentDistance(from,to,point(stroke.points[i]!),point(p))<=radius+stroke.width/2);
}
