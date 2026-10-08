uniform vec3 uFog;uniform float uDay;
varying vec3 vGrassWorld;varying float vHeight;varying float vVariation;
void main(){
 vec3 base=mix(vec3(.12,.18,.046),vec3(.31,.36,.11),vVariation);
 vec3 color=base*(.48+min(vHeight,1.)*.72)*(.16+uDay*.84);
 color+=vec3(.12,.12,.04)*pow(min(vHeight,1.),3.)*uDay;
 float fog=1.-exp(-pow(distance(cameraPosition,vGrassWorld)*.00165,2.));
 gl_FragColor=vec4(mix(color,uFog,fog),1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}
