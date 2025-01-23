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

vec2 adjacentPixels[4] = vec2[](
  vec2(-1, 0), 
  vec2(1, 0), 
  vec2(0, 1), 
  vec2(0, -1)
);

vec3 color = vec3(1.0, 1.0, 1.0);

//float biasCube = 0.002;

float visibility = 1.0;
float shadowSpread = 1100.0;

void main()
{
  for (int i = 0; i < 4; i++) { 
    vec3 biased = vec3(positionFromLightPov.xy + adjacentPixels[i]/shadowSpread, positionFromLightPov.z);
    //vec3 biased = vec3(positionFromLightPov.xy + adjacentPixels[i]/shadowSpread, positionFromLightPov.z - biasCube);
    float hitByLight = texture(shadowMap, biased);
    visibility *= max(hitByLight, 0.83);
  }
  
  vec3 normalizedNormal = normalize(vNormal);
  float lightCos = dot(uLightDirection, normalizedNormal);
  float brightness = max(lightCos * visibility, ambientLight);
  fragColor = color * max(brightness * visibility, ambientLight);
}`;

const canvas = document.querySelector('canvas');

const gl = document.querySelector('canvas').getContext('webgl2');

const program = createProgram(gl, vertexShaderSrc, fragmentShaderSrc);
const depthProgram = createProgram(gl, depthVertexShader, depthFragmentShader);

gl.enable(gl.DEPTH_TEST);
gl.enable(gl.CULL_FACE);

const origin = new DOMPoint(0, 0, 0);

// Setup Light
gl.useProgram(program);
const inverseLightDirection = normalize(new DOMPoint(-0.0, 1, -0.5));
const lightDirectionLoc = gl.getUniformLocation(program,'uLightDirection');
gl.uniform3fv(lightDirectionLoc, new Float32Array([inverseLightDirection.x, inverseLightDirection.y, inverseLightDirection.z]));
const lightPovProjection = createOrtho(-1,1,-1,1,0,6);
const lightPovView = createLookAt(inverseLightDirection, origin);
const lightPovMvp = lightPovProjection.multiply(lightPovView);

const lightPovMvpDepthLocation = gl.getUniformLocation(depthProgram, 'lightPovMvp');
gl.useProgram(depthProgram);
gl.uniformMatrix4fv(lightPovMvpDepthLocation, false, lightPovMvp.toFloat32Array());

const textureSpaceConversion = new DOMMatrix([
  0.5, 0.0, 0.0, 0.0,
  0.0, 0.5, 0.0, 0.0,
  0.0, 0.0, 0.5, 0.0,
  0.5, 0.5, 0.5, 1.0
]);
const textureSpaceMvp = textureSpaceConversion.multiply(lightPovMvp);
const lightPovMvpRenderLocation = gl.getUniformLocation(program, 'lightPovMvp');
gl.useProgram(program);
gl.uniformMatrix4fv(lightPovMvpRenderLocation, false, textureSpaceMvp.toFloat32Array());

// Set Camera MVP Matrix
const cameraPosition = new DOMPoint(-0.6, 0.7, -0.6);
const view = createLookAt(cameraPosition, origin);

let projection = createPerspective(Math.PI / 3, canvas.width / canvas.height, 0.1, 10);

let modelViewProjection = projection.multiply(view);

const projectionLoc = gl.getUniformLocation(program, 'modelViewProjection');
gl.uniformMatrix4fv(projectionLoc, false, modelViewProjection.toFloat32Array());


//normalMatrix not used

//avoids cube to be rendered inside and below the base cube
let baseCubeHeight = 0.01; 

//initialization of all cubes and sphere useful variables
const verticesPerCube = 36;
const numberOfCubes = 5;
let cubes = null;


//Creating vertex buffer
const vertexBuffer = gl.createBuffer();

// Depth Texture
const depthTextureSize = new DOMPoint(1024, 1024);
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
const shadowMapLocation = gl.getUniformLocation(program, 'shadowMap');

let previousTime = 0;

const lightRotationAngles = new DOMPoint();
const lightSpinRate = 0.15;
const lightRiseSetRate = 0.05;

const cameraRotationAngles = new DOMPoint();
const cameraSpinRate = 0.1;
let cameraZoom = 1;
const cameraZoomRate = 0.1;

function drawParallelepipeds(time) {
  const interval = (time - previousTime) / 1000;
  previousTime = time;

  lightRotationAngles.x += lightSpinRate * interval;
  lightRotationAngles.y += lightRiseSetRate * interval;
  lightRotationAngles.z += lightSpinRate * interval;

  inverseLightDirection.x = (Math.cos(lightRotationAngles.x) * 1);
  inverseLightDirection.y = Math.abs(Math.sin(lightRotationAngles.y) * 2);
  inverseLightDirection.z = (Math.sin(lightRotationAngles.z) * 1);

  const normalizedDirection = normalize(inverseLightDirection)
  gl.useProgram(program)
  gl.uniform3fv(lightDirectionLoc, new Float32Array([normalizedDirection.x, normalizedDirection.y, normalizedDirection.z]));

  const lightPovView = createLookAt(inverseLightDirection, origin);
  const lightPovMvp = lightPovProjection.multiply(lightPovView);

  gl.enable(gl.CULL_FACE);

  // Render shadow map to depth texture
  gl.useProgram(depthProgram);

  gl.uniformMatrix4fv(lightPovMvpDepthLocation, false, lightPovMvp.toFloat32Array());

  gl.bindFramebuffer(gl.FRAMEBUFFER, depthFramebuffer);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.viewport(0, 0, depthTextureSize.x, depthTextureSize.y);
  gl.cullFace(gl.FRONT);
  gl.drawArrays(gl.TRIANGLES, 0, verticesPerCube * numberOfCubes);


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
  gl.cullFace(gl.BACK);
  gl.drawArrays(gl.TRIANGLES, 0, verticesPerCube * numberOfCubes);

  requestAnimationFrame(drawParallelepipeds);
}


function clamp(num, min, max) {
  return Math.min(Math.max(num, min), max);
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
  //console.log(`Viewport size: ${gl.getParameter(gl.VIEWPORT)}`);


  drawParallelepipeds(0);
}
window.addEventListener('resize', resizeCanvasToWindow);


//generate random parallelepipeds (clicks)
function RandParallelepipeds() {

	// new random dimensions for the cube
  let width_cube1 = getRandomFloat(0.05, 0.2);
  let height_cube1 = getRandomFloat(0.1, 0.3);
  let depth_cube1 = getRandomFloat(0.05, 0.2);

  let width_cube2 = getRandomFloat(0.5, 0.2);
  let height_cube2 = getRandomFloat(0.1, 0.3);
  let depth_cube2 = getRandomFloat(0.05, 0.2);

  let width_cube3 = getRandomFloat(0.05, 0.2);
  let height_cube3 = getRandomFloat(0.1, 0.3);
  let depth_cube3 = getRandomFloat(0.05, 0.2);

  let width_cube4 = getRandomFloat(0.05, 0.2);
  let height_cube4 = getRandomFloat(0.1, 0.3);
  let depth_cube4 = getRandomFloat(0.05, 0.2);


	//avoids cube to be rendered inside and below the base cube 
	let upperCubeYPosition1 = baseCubeHeight + height_cube1;
  let upperCubeYPosition2 = baseCubeHeight + height_cube2;
  let upperCubeYPosition3 = baseCubeHeight + height_cube3;
  let upperCubeYPosition4 = baseCubeHeight + height_cube4;

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
  let cubePositionX1 = getRandomFloat(minOffsetX1, maxOffsetX1);
  let cubePositionZ1 = getRandomFloat(minOffsetZ1, maxOffsetZ1);

  let cubePositionX2 = getRandomFloat(minOffsetX2, maxOffsetX2);
  let cubePositionZ2 = getRandomFloat(minOffsetZ2, maxOffsetZ2);

  let cubePositionX3 = getRandomFloat(minOffsetX3, maxOffsetX3);
  let cubePositionZ3 = getRandomFloat(minOffsetZ3, maxOffsetZ3);

  let cubePositionX4 = getRandomFloat(minOffsetX4, maxOffsetX4);
  let cubePositionZ4 = getRandomFloat(minOffsetZ4, maxOffsetZ4);


  // new vertices for the cube
  cubes = new Float32Array([
      ...createCubeWithNormals(1, baseCubeHeight, 1, 0, 0, 0), // base plan
      ...createCubeWithNormals(width_cube1, height_cube1, depth_cube1, cubePositionX1, upperCubeYPosition1, cubePositionZ1), // new cube
      ...createCubeWithNormals(width_cube2, height_cube2, depth_cube2, cubePositionX2, upperCubeYPosition2, cubePositionZ2),
      ...createCubeWithNormals(width_cube3, height_cube3, depth_cube3, cubePositionX3, upperCubeYPosition3, cubePositionZ3),
      ...createCubeWithNormals(width_cube4, height_cube4, depth_cube4, cubePositionX4, upperCubeYPosition4, cubePositionZ4)
  ]);

  // Updating the buffer with the new cube
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, cubes, gl.STATIC_DRAW);

	//Buffer attributes
	gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
	gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
	gl.enableVertexAttribArray(0);
	gl.enableVertexAttribArray(1);

	// Update the shadow map
  gl.useProgram(depthProgram);
  gl.bindFramebuffer(gl.FRAMEBUFFER, depthFramebuffer);
  gl.viewport(0, 0, depthTextureSize.x, depthTextureSize.y);
  gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, verticesPerCube * numberOfCubes);

	if(window.innerWidth != canvas.width || window.innerHeight != canvas.height ) {
		//Resize and redraw
		resizeCanvasToWindow();
	}
	else {
		//Redraw the scene
		drawParallelepipeds(0);
	}
}

