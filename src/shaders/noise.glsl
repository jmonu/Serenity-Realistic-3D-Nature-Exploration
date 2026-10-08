float hash21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise2(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(hash21(i),hash21(i+vec2(1,0)),u.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1)),u.x),u.y);}
float fbm2(vec2 p){return noise2(p)*.57+noise2(p*2.03+17.)*.28+noise2(p*4.17-9.)*.15;}
