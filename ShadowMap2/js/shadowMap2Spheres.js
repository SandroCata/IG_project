const depthVertexShader = `#version 300 es

layout(location=0) in vec4 aPosition;

uniform mat4 lightPovMvp;

void main(){
  gl_Position = lightPovMvp * aPosition;
}
`;

const depthFragmentShader = `#version 300 es
precision mediump float;

out float fragmentdepth;

void main(){
 fragmentdepth = gl_FragCoord.z;
}
`;

const vertexShaderSrc = `#version 300 es

layout(location=0) in vec4 aPosition;
layout(location=1) in vec3 aNormal;

uniform mat4 modelViewProjection;
uniform mat4 lightPovMvp;

out vec3 vNormal;
out vec4 positionFromLightPov;

void main()
{
    vNormal = aNormal;
    gl_Position = modelViewProjection * aPosition;
    positionFromLightPov = lightPovMvp * aPosition;
}`;


const fragmentShaderSrc = `#version 300 es
precision mediump float;

uniform vec3 uLightDirection;

in vec3 vNormal;
in vec4 positionFromLightPov;

uniform mediump sampler2DShadow shadowMap;

out vec3 fragColor;

float ambientLight = 0.2;
float biasSphere = 0.02;
float visibility = 1.0;
float shadowSpread = 1000.0;

vec2 adjacentPixels[4] = vec2[](
  vec2(-1, 0), 
  vec2(1, 0), 
  vec2(0, 1), 
  vec2(0, -1)
);

vec3 color = vec3(1.0, 1.0, 1.0);

void main()
{
  for (int i = 0; i < 4; i++) { 
    vec3 biased = vec3(positionFromLightPov.xy + adjacentPixels[i]/shadowSpread, positionFromLightPov.z - biasSphere);
    //vec3 biased = vec3(positionFromLightPov.xy + adjacentPixels[i]/shadowSpread, positionFromLightPov.z);
    float hitByLight = texture(shadowMap, biased);
    visibility *= max(hitByLight, 0.83);
  }
  
  vec3 normalizedNormal = normalize(vNormal);
  vec3 normalizedLightDir = normalize(uLightDirection);

  float lightCos = dot(normalizedLightDir, normalizedNormal);
  float brightness = max(lightCos * visibility, ambientLight);
  fragColor = color * max(brightness, ambientLight);
}`;

const canvas = document.querySelector('canvas');

const gl = document.querySelector('canvas').getContext('webgl2');

const program = createProgram(gl, vertexShaderSrc, fragmentShaderSrc);
const depthProgram = createProgram(gl, depthVertexShader, depthFragmentShader);

gl.enable(gl.DEPTH_TEST);
//gl.enable(gl.CULL_FACE);

const origin = new DOMPoint(0, 0, 0);

// Setup Light
gl.useProgram(program);
let inverseLightDirection = new DOMPoint(-0.0, 1, -0.5);
let lightDirectionLoc = gl.getUniformLocation(program,'uLightDirection');
gl.uniform3fv(lightDirectionLoc, new Float32Array([inverseLightDirection.x, inverseLightDirection.y, inverseLightDirection.z]));
let lightPovProjection = createOrtho(-1,1,-1,1,0,6);
let lightPovView = createLookAt(inverseLightDirection, origin);
let lightPovMvp = lightPovProjection.multiply(lightPovView);

const lightPovMvpDepthLocation = gl.getUniformLocation(depthProgram, 'lightPovMvp');
gl.useProgram(depthProgram);
gl.uniformMatrix4fv(lightPovMvpDepthLocation, false, lightPovMvp.toFloat32Array());

const textureSpaceConversion = new DOMMatrix([
  0.5, 0.0, 0.0, 0.0,
  0.0, 0.5, 0.0, 0.0,
  0.0, 0.0, 0.5, 0.0,
  0.5, 0.5, 0.5, 1.0
]);
let textureSpaceMvp = textureSpaceConversion.multiply(lightPovMvp);
let lightPovMvpRenderLocation = gl.getUniformLocation(program, 'lightPovMvp');
gl.useProgram(program);
gl.uniformMatrix4fv(lightPovMvpRenderLocation, false, textureSpaceMvp.toFloat32Array());

// Set Camera MVP Matrix
let cameraPosition = new DOMPoint(-0.6, 0.7, -0.6);
let view = createLookAt(cameraPosition, origin);

let projection = createPerspective(Math.PI / 3, canvas.width / canvas.height, 0.1, 10);

let modelViewProjection = projection.multiply(view);

const projectionLoc = gl.getUniformLocation(program, 'modelViewProjection');
gl.uniformMatrix4fv(projectionLoc, false, modelViewProjection.toFloat32Array());


//avoids cube to be rendered inside and below the base cube
let baseCubeHeight = 0.01; 

//initialization of all cubes and sphere useful variables
let baseVertices = null;
let sphereData1 = null;
let sphereData2 = null;
let sphereData3 = null;
let sphereData4 = null;

//Creating vertex buffer
let vertexBuffer = gl.createBuffer();
let indexBuffer = gl.createBuffer();

let SphereVertices1= null;
let SphereVertices2= null;
let SphereVertices3= null;
let SphereVertices4= null;

let SphereIndices1= null;
let SphereIndices2= null;
let SphereIndices3= null;
let SphereIndices4= null;

// Depth Texture
const depthTextureSize = new DOMPoint(4096, 4096);
const depthTexture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, depthTexture);
gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT32F, depthTextureSize.x, depthTextureSize.y);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

const depthFramebuffer = gl.createFramebuffer();
gl.bindFramebuffer(gl.FRAMEBUFFER, depthFramebuffer);
gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTexture, 0);

// Get access to the shadow map uniform so we can set it during draw
let shadowMapLocation = gl.getUniformLocation(program, 'shadowMap');

let previousTime = 0;

const lightRotationAngles = new DOMPoint();
const lightSpinRate = 0.15;
const lightRiseSetRate = 0.05;

const cameraRotationAngles = new DOMPoint();
const cameraSpinRate = 0.1;
let cameraZoom = 1;
const cameraZoomRate = 0.1;

function clamp(num, min, max) {
  return Math.min(Math.max(num, min), max);
}

function drawSpheres(time) {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const interval = (time - previousTime) / 1000;
    previousTime = time;

    lightRotationAngles.x += lightSpinRate * interval;
    lightRotationAngles.y += lightRiseSetRate * interval;
    lightRotationAngles.z += lightSpinRate * interval;

    inverseLightDirection.x = (Math.cos(lightRotationAngles.x) * 1);
    inverseLightDirection.y = Math.abs(Math.sin(lightRotationAngles.y) * 2);
    inverseLightDirection.z = (Math.sin(lightRotationAngles.z) * 1);

    gl.useProgram(program)
    gl.uniform3fv(lightDirectionLoc, new Float32Array([inverseLightDirection.x, inverseLightDirection.y, inverseLightDirection.z]));

    const lightPovView = createLookAt(inverseLightDirection, origin);
    const lightPovMvp = lightPovProjection.multiply(lightPovView);
    gl.useProgram(depthProgram)
    gl.uniformMatrix4fv(lightPovMvpDepthLocation, false, lightPovMvp.toFloat32Array());

    // Render shadow map to depth texture
    gl.useProgram(depthProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, depthFramebuffer);
    gl.viewport(0, 0, depthTextureSize.x, depthTextureSize.y);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    //gl.cullFace(gl.FRONT);
    

    // Base Cube drawing
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, baseVertices, gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0); // Position
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12); // Normal
    gl.enableVertexAttribArray(0);
    gl.enableVertexAttribArray(1);
    gl.drawArrays(gl.TRIANGLES, 0, baseVertices.length / 6);

    // Sphere 1 drawing
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, SphereVertices1, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, SphereIndices1, gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0); 
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12); 
    gl.enableVertexAttribArray(0);
    gl.enableVertexAttribArray(1);
    gl.drawElements(gl.TRIANGLES, SphereIndices1.length, gl.UNSIGNED_SHORT, 0);
    
    // Sphere 2 drawing
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, SphereVertices2, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, SphereIndices2, gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0); 
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12); 
    gl.enableVertexAttribArray(0);
    gl.enableVertexAttribArray(1);
    gl.drawElements(gl.TRIANGLES, SphereIndices2.length, gl.UNSIGNED_SHORT, 0);

    // Sphere 3 drawing
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, SphereVertices3, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, SphereIndices3, gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0); 
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12); 
    gl.enableVertexAttribArray(0);
    gl.enableVertexAttribArray(1);
    gl.drawElements(gl.TRIANGLES, SphereIndices3.length, gl.UNSIGNED_SHORT, 0);

    // Sphere 4 drawing
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, SphereVertices4, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, SphereIndices4, gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0); 
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12); 
    gl.enableVertexAttribArray(0);
    gl.enableVertexAttribArray(1);
    gl.drawElements(gl.TRIANGLES, SphereIndices4.length, gl.UNSIGNED_SHORT, 0);
    
    
    // MAIN RENDER
    gl.useProgram(program);

    cameraRotationAngles.x -= cameraSpinRate * interval;
    cameraRotationAngles.y -= cameraSpinRate * interval;
    cameraRotationAngles.z -= cameraSpinRate * interval;
    cameraZoom += cameraZoomRate * interval;
    const zoomPos = clamp(Math.sin(cameraZoom) * -2, -2, -1.2);
    cameraPosition.x = (Math.cos(cameraRotationAngles.x) * zoomPos);
    cameraPosition.y = Math.abs(Math.cos(cameraRotationAngles.y) * 0.2) + 0.5;
    cameraPosition.z = (Math.sin(cameraRotationAngles.z) * zoomPos);
    const view = createLookAt(cameraPosition, origin);
    const modelViewProjection = projection.multiply(view);
    gl.uniformMatrix4fv(projectionLoc, false, modelViewProjection.toFloat32Array());
    const textureSpaceMvp = textureSpaceConversion.multiply(lightPovMvp);
    gl.uniformMatrix4fv(lightPovMvpRenderLocation, false, textureSpaceMvp.toFloat32Array());

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.bindTexture(gl.TEXTURE_2D, depthTexture);
    gl.uniform1i(shadowMapLocation, 0);
    //gl.cullFace(gl.BACK);

    // Base Cube drawing
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, baseVertices, gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0); // Position
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12); // Normal
    gl.enableVertexAttribArray(0);
    gl.enableVertexAttribArray(1);
    gl.drawArrays(gl.TRIANGLES, 0, baseVertices.length / 6);

    // Sphere 1 drawing
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, SphereVertices1, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, SphereIndices1, gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0); 
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12); 
    gl.enableVertexAttribArray(0);
    gl.enableVertexAttribArray(1);
    gl.drawElements(gl.TRIANGLES, SphereIndices1.length, gl.UNSIGNED_SHORT, 0);

    
    // Sphere 2 drawing
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, SphereVertices2, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, SphereIndices2, gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0); 
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12); 
    gl.enableVertexAttribArray(0);
    gl.enableVertexAttribArray(1);
    gl.drawElements(gl.TRIANGLES, SphereIndices2.length, gl.UNSIGNED_SHORT, 0);

    // Sphere 3 drawing
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, SphereVertices3, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, SphereIndices3, gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0); 
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12); 
    gl.enableVertexAttribArray(0);
    gl.enableVertexAttribArray(1);
    gl.drawElements(gl.TRIANGLES, SphereIndices3.length, gl.UNSIGNED_SHORT, 0);

    // Sphere 4 drawing
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, SphereVertices4, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, SphereIndices4, gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0); 
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12); 
    gl.enableVertexAttribArray(0);
    gl.enableVertexAttribArray(1);
    gl.drawElements(gl.TRIANGLES, SphereIndices4.length, gl.UNSIGNED_SHORT, 0);

    requestAnimationFrame(drawSpheres);

}

// Update dimensions depending on window size
function resizeCanvasToWindow() {
  // Get pixel ratio
  const dpr = window.devicePixelRatio || 1;

  // Set canvas size
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);

  // Set canvas style
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;

  // Update viewport of WebGL
  gl.viewport(0, 0, canvas.width, canvas.height);


  //Recompute some camera and light config
  gl.useProgram(program);
  projection = createPerspective(Math.PI / 3, canvas.width / canvas.height, 0.1, 50);
  modelViewProjection = projection.multiply(view);

  gl.uniformMatrix4fv(projectionLoc, false, modelViewProjection.toFloat32Array());

  console.log(`Canvas size: ${canvas.width}x${canvas.height}`);

}
window.addEventListener('resize', resizeCanvasToWindow);

//generate random pseudosphere
function RandSpheres() {
  
  //cleanUpBuffers();

	// new random dimensions for the cube
  let sphereRadius1 = getRandomFloat(0.1, 0.2);
  let sphereRadius2 = getRandomFloat(0.1, 0.2);
  let sphereRadius3 = getRandomFloat(0.1, 0.2);
  let sphereRadius4 = getRandomFloat(0.1, 0.2);


	//avoids sphere to be rendered inside and below the base cube 
	let spherePositionY1 = baseCubeHeight / 2 + sphereRadius1;
  let spherePositionY2 = baseCubeHeight / 2 + sphereRadius2;
  let spherePositionY3 = baseCubeHeight / 2 + sphereRadius3;
  let spherePositionY4 = baseCubeHeight / 2 + sphereRadius4;

	// Complete quadrants limitations
  let minOffsetX1 = -0.6; 
  let maxOffsetX1 = -0.4; 
  let minOffsetZ1 = -0.4; 
  let maxOffsetZ1 = -0.6; 

  let minOffsetX2 = 0.4; 
  let maxOffsetX2 = 0.6; 
  let minOffsetZ2 = -0.4; 
  let maxOffsetZ2 = -0.6; 

  let minOffsetX3 = -0.6; 
  let maxOffsetX3 = -0.4; 
  let minOffsetZ3 = 0.4; 
  let maxOffsetZ3 = 0.6; 

  let minOffsetX4 = 0.4; 
  let maxOffsetX4 = 0.6; 
  let minOffsetZ4 = 0.4; 
  let maxOffsetZ4 = 0.6; 

  // random positions inside quadrants
  let spherePositionX1 = getRandomFloat(minOffsetX1, maxOffsetX1);
  let spherePositionZ1 = getRandomFloat(minOffsetZ1, maxOffsetZ1);

  let spherePositionX2 = getRandomFloat(minOffsetX2, maxOffsetX2);
  let spherePositionZ2 = getRandomFloat(minOffsetZ2, maxOffsetZ2);

  let spherePositionX3 = getRandomFloat(minOffsetX3, maxOffsetX3);
  let spherePositionZ3 = getRandomFloat(minOffsetZ3, maxOffsetZ3);

  let spherePositionX4 = getRandomFloat(minOffsetX4, maxOffsetX4);
  let spherePositionZ4 = getRandomFloat(minOffsetZ4, maxOffsetZ4);

  // Genera i dati della sfera e della base
  baseVertices = createCubeWithNormals(1, baseCubeHeight, 1, 0, 0, 0);

  sphereData1 = createSphere(sphereRadius1, 256, spherePositionX1, spherePositionY1, spherePositionZ1);
  sphereData2 = createSphere(sphereRadius2, 256, spherePositionX2, spherePositionY2, spherePositionZ2);
  sphereData3 = createSphere(sphereRadius3, 256, spherePositionX3, spherePositionY3, spherePositionZ3);
  sphereData4 = createSphere(sphereRadius4, 256, spherePositionX4, spherePositionY4, spherePositionZ4);

  SphereVertices1 = sphereData1.vertices;
  SphereVertices2 = sphereData2.vertices;
  SphereVertices3 = sphereData3.vertices;
  SphereVertices4 = sphereData4.vertices;

  SphereIndices1 = sphereData1.indices;
  SphereIndices2 = sphereData2.indices;
  SphereIndices3 = sphereData3.indices;
  SphereIndices4 = sphereData4.indices;

	if(window.innerWidth != canvas.width || window.innerHeight != canvas.height ) {
		//Resize and redraw
		resizeCanvasToWindow();
    drawSpheres(0);
	}
	else {
		//Redraw the scene
		drawSpheres(0);
	}
}