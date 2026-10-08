uniform float uTime;uniform mat4 uReflectionMatrix;attribute float groundHeight;varying vec3 vWorld;varying float vDepth;varying vec4 vReflect;
void main(){vec3 p=position;p.y+=sin(p.x*.2+uTime*.6)*.025+cos(p.z*.16+uTime*.4)*.018;vec4 wp=modelMatrix*vec4(p,1.);vWorld=wp.xyz;vDepth=2.4-groundHeight;vReflect=uReflectionMatrix*wp;gl_Position=projectionMatrix*viewMatrix*wp;}
