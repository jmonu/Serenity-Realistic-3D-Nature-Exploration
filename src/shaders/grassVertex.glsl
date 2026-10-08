uniform float uTime;
uniform float uWind;
uniform vec3 uPlayer;
varying vec3 vGrassWorld;
varying float vHeight;
varying float vVariation;
void main(){
 vec3 p=position; vec3 root=(modelMatrix*instanceMatrix*vec4(0,0,0,1)).xyz;
 float phase=hash21(root.xz)*6.283;
 float gust=fbm2(root.xz*.045+vec2(uTime*.16,uTime*.05))-.35;
 vec2 direction=normalize(vec2(.8+sin(uTime*.023)*.3,.4+cos(uTime*.017)*.3));
 p.xz+=direction*(gust*.68+sin(uTime*1.8+phase)*.07)*uWind*p.y*p.y;
 vec2 away=root.xz-uPlayer.xz;float distanceToPlayer=length(away);
 p.xz+=away/max(distanceToPlayer,.01)*(1.-smoothstep(.2,1.7,distanceToPlayer))*p.y*.6;
 vec4 wp=modelMatrix*instanceMatrix*vec4(p,1.);vGrassWorld=wp.xyz;vHeight=position.y;vVariation=hash21(root.xz);
 float fade=1.-smoothstep(45.,70.,distance(cameraPosition.xz,root.xz));
 wp.y=root.y+(wp.y-root.y)*fade;
 gl_Position=projectionMatrix*viewMatrix*wp;
}
