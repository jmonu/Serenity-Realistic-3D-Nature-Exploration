uniform float uTime;uniform float uDay;uniform float uWind;uniform vec3 uFog;uniform vec3 uSun;uniform sampler2D uReflection;uniform float uHasReflection;
varying vec3 vWorld;varying float vDepth;varying vec4 vReflect;
void main(){if(vDepth<.015)discard;vec2 uv=vWorld.xz;float t=uTime;
 float n=fbm2(uv*.33+vec2(t*.08,t*.035));
 float nx=fbm2((uv+vec2(.25,0))*.33+vec2(t*.08,t*.035));float nz=fbm2((uv+vec2(0,.25))*.33+vec2(t*.08,t*.035));
 vec3 normal=normalize(vec3((n-nx)*1.3*uWind,1.,(n-nz)*1.3*uWind));vec3 view=normalize(cameraPosition-vWorld);
 float fresnel=.12+.88*pow(1.-max(dot(view,normal),0.),4.);
 vec3 shallow=vec3(.16,.25,.18);vec3 deep=vec3(.035,.13,.125);vec3 base=mix(shallow,deep,smoothstep(0.,7.,vDepth))*(.18+.82*uDay);
 vec2 reflectUV=vReflect.xy/vReflect.w+normal.xz*.022;vec3 reflected=texture2D(uReflection,clamp(reflectUV,.002,.998)).rgb;
 reflected=mix(uFog*.75,reflected,uHasReflection);vec3 color=mix(base,reflected,fresnel*.88);
 float ripple=pow(.5+.5*sin(vDepth*12.-t*1.4+n*5.),12.)*(1.-smoothstep(0.,1.8,vDepth));color+=ripple*.06*uDay;
 vec3 light=normalize(uSun);float spec=pow(max(dot(reflect(-light,normal),view),0.),180.);color+=vec3(1.,.86,.6)*spec*.7*uDay;
 float fog=1.-exp(-pow(distance(cameraPosition,vWorld)*.0017,2.));gl_FragColor=vec4(mix(color,uFog,fog),mix(.62,.98,smoothstep(0.,2.,vDepth)));
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}
