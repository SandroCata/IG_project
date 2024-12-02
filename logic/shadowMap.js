//by using sampler2DShadow, while WebGL won’t attempt to smooth out the scaled pixels of your shadow map, it does smooth out the rendered pixels in-between the shadowed and lit areas.

//MAIN

//vertex and fragment shaders for the light point of view

//Light POV

//vertexShader for shadow map generation
//aPosition: positions of verteces
//lightPovMvp: ModelViewProj matrix for light POV
//gl_Position: vertex converted in clipped space of light

const depthVertexShader = `#version 300 es				

layout(location=0) in vec4 aPosition;

uniform mat4 lightPovMvp;

void main(){
gl_Position = lightPovMvp * aPosition;
}
`;

//In the fragment shader, rather than output a color, we output the z value of the current pixel
//fragementShader for generating depth of each fragment
//fragDepth: depth(z) of fragment is kept in shadow map

const depthFragmentShader = `#version 300 es
precision mediump float;

out float fragDepth;

void main(){
fragDepth = gl_FragCoord.z;
}
`;

//Camera POV

const vertexShaderSrc = `#version 300 es

layout(location=0) in vec4 aPosition;
layout(location=1) in vec3 aNormal;

uniform mat4 modelViewProjection;
uniform mat4 lightPovMvp;
uniform mat4 normalMatrix;

out vec3 vNormal;
out vec4 positionFromLightPov;


void main()
{
	//vNormal = aNormal;
	vNormal = normalize((normalMatrix * vec4(aNormal, 0.0)).xyz);
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

//improvement parametrs
float bias = 0.005;
float visibility = 1.0;
float shadowSpread = 1100.0;
uniform float lightIntensity;

//sampling the four adjacent pixels
vec2 adjacentPixels[5] = vec2[](
	vec2(0, 0),
	vec2(-1, 0), 
	vec2(1, 0), 
	vec2(0, 1), 
	vec2(0, -1)
);

vec3 color = vec3(1.0, 1.0, 1.0);

void main()
{
	for (int i = 0; i < 5; i++) {
		vec3 sampledPos = vec3(positionFromLightPov.xy + adjacentPixels[i]/shadowSpread, positionFromLightPov.z - bias);
		float hitByLight = texture(shadowMap, sampledPos);
    	visibility *= max(hitByLight, 0.9);
	}
	vec3 normalizedNormal = normalize(vNormal);
	vec3 normalizedLightDir = normalize(uLightDirection);

	float lightCos = max(dot(normalizedLightDir, normalizedNormal), ambientLight);
	float brightness = lightCos * visibility * lightIntensity + ambientLight;
	fragColor = color * brightness;
}`;
//compare with Blinn-Phon Model and see if you can enhance

//Context creation for WebGL
const gl = document.querySelector('canvas').getContext('webgl2');

//Compiling and executing the shader program
const program = createProgram(gl, vertexShaderSrc, fragmentShaderSrc);
const depthProgram = createProgram(gl, depthVertexShader, depthFragmentShader);

//Depth test enabled so that overlayed items are properly rendered 
gl.enable(gl.DEPTH_TEST);

//bias improvement
//gl.enable(gl.CULL_FACE);

//Setting origin point
const origin = new DOMPoint(0, 0, 0);

// Set Light MVP Matrix (light direction can vary)
gl.useProgram(program);
let inverseLightDirection = new DOMPoint(-0.5, 2, -2); 				//initially here
let lightDirectionLoc = gl.getUniformLocation(program,'uLightDirection');
gl.uniform3fv(lightDirectionLoc, new Float32Array([inverseLightDirection.x, inverseLightDirection.y, inverseLightDirection.z]));
let lightPovProjection = createOrtho(-1,1,-1,1,0,4);
let lightPovView = createLookAt(inverseLightDirection, origin);
let lightPovMvp = lightPovProjection.multiply(lightPovView);

let lightPovMvpDepthLocation = gl.getUniformLocation(depthProgram, 'lightPovMvp');
gl.useProgram(depthProgram);
gl.uniformMatrix4fv(lightPovMvpDepthLocation, false, lightPovMvp.toFloat32Array());

//substitutes 'vec3 lightPovPositionInTexture = positionFromLightPov.xyz * 0.5 + 0.5;' in fragmentShader;
//instead of doing convertion for each pixel we do it for each draw call
//All the vertices are already multiplied by the light pov matrix to get their position from the light. So you multiply that matrix by a matrix that scales 0.5 and translates 0.5 before using it, same effect.
//translation on last row and scale on the diagonal
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


// Set Camera MVP Matrix (camera Position can vary)
let cameraPosition = new DOMPoint(1, 1, 2);   				//initially here
let view = createLookAt(cameraPosition, origin);
let projection = createPerspective(Math.PI / 3, 16 / 9, 0.1, 10);
let modelViewProjection = projection.multiply(view);

//Passing MVP to the program shader
let projectionLoc = gl.getUniformLocation(program, 'modelViewProjection');
gl.uniformMatrix4fv(projectionLoc, false, modelViewProjection.toFloat32Array());

let normalMatrix = calculateNormalMatrix(view.toFloat32Array());

const normalMatrixLoc = gl.getUniformLocation(program, 'normalMatrix');
gl.uniformMatrix4fv(normalMatrixLoc, false, new Float32Array(normalMatrix));


// Create cubes and bind their data
let width_cube=getRandomFloat(0.1, 0.7);
let height_cube=getRandomFloat(0.25, 0.75);
let depth_cube=getRandomFloat(0.1, 0.4);
console.log("width_cube "+ width_cube);
console.log("height_cube "+ height_cube);
console.log("depth_cube "+ depth_cube);

//avoids cube to be rendered inside and below the base cube
let baseCubeHeight = 0.1; 
let upperCubeYPosition = baseCubeHeight / 2 + height_cube / 2;


const verticesPerCube = 6 * 6;
let cubes = new Float32Array([
	...createCubeWithNormals(1, 0.01, 1, 0, 0, 0),
	...createCubeWithNormals(width_cube, height_cube, depth_cube, 0, upperCubeYPosition, 0)
]);

//Creating vertex buffer
const vertexBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
gl.bufferData(gl.ARRAY_BUFFER, cubes, gl.STATIC_DRAW);

//Buffer attributes
gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
gl.enableVertexAttribArray(0);
gl.enableVertexAttribArray(1);

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
let shadowMapLocation = gl.getUniformLocation(program, 'shadowMap');

let lightIntensity = 1.0;  // Intensità iniziale della luce
const lightIntensityLoc = gl.getUniformLocation(program, 'lightIntensity');
gl.uniform1f(lightIntensityLoc, lightIntensity);

//Rendering
function draw() {
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// Render shadow map to depth texture
	gl.useProgram(depthProgram);
	//gl.cullFace(gl.FRONT);
	gl.bindFramebuffer(gl.FRAMEBUFFER, depthFramebuffer);
	gl.viewport(0, 0, depthTextureSize.x, depthTextureSize.y);
	gl.drawArrays(gl.TRIANGLES, 0, verticesPerCube * 2);

	// Set depth texture and render scene to canvas
	gl.useProgram(program);
	//gl.cullFace(gl.BACK);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
	gl.bindTexture(gl.TEXTURE_2D, depthTexture);
	gl.uniform1i(shadowMapLocation, 0);
	gl.drawArrays(gl.TRIANGLES, 0, verticesPerCube * 2);
}
    
    draw();

//Show settings on UI
displaySettings(cameraPosition, inverseLightDirection, lightIntensity);

//change camera position values
changeCamera(cameraPosition);

//change light direction values
changeLightDir(inverseLightDirection);

//change light intensity 
document.getElementById('lightIntV').addEventListener('input', (e) => {
	lightIntensity = parseFloat(e.target.value);
	console.log(lightIntensity);
	document.getElementById('lightInt').innerText = lightIntensity.toFixed(2);
});

//apply camera changes
applyCameraChanges(gl, cameraPosition, projection, origin, normalMatrixLoc, projectionLoc, draw); 

//apply lightDir changes
applyLightDirChanges(gl, inverseLightDirection, lightPovProjection, origin, lightDirectionLoc, depthProgram, program, lightPovMvpDepthLocation, lightPovMvpRenderLocation, textureSpaceConversion, depthFramebuffer, depthTextureSize, draw);

//apply light Int change
document.getElementById('applyLightIntensity').addEventListener('click', () => {

	gl.useProgram(program);
	gl.uniform1f(lightIntensityLoc, lightIntensity);  // update uniform var in shader

	draw();  // Redraws the scene
	console.log('Light intensity updated:', lightIntensity);
});

document.getElementById('RandCube').addEventListener('click', () => {
	// new random dimensions for the cube
    width_cube = getRandomFloat(0.1, 0.7);
    height_cube = getRandomFloat(0.25, 0.75);
    depth_cube = getRandomFloat(0.1, 0.4);

    console.log("New Cube Dimensions:");
    console.log("Width: ", width_cube);
    console.log("Height: ", height_cube);
    console.log("Depth: ", depth_cube);

	//avoids cube to be rendered inside and below the base cube 
	upperCubeYPosition = baseCubeHeight / 2 + height_cube / 2;

    // new vertices for the cube
    cubes = new Float32Array([
        ...createCubeWithNormals(1, 0.01, 1, 0, 0, 0), // base plan
        ...createCubeWithNormals(width_cube, height_cube, depth_cube, 0, upperCubeYPosition, 0) // new cube
    ]);

    // Updating the bufer with the new cube
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, cubes, gl.STATIC_DRAW);

	// Update the shadow map
    gl.useProgram(depthProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, depthFramebuffer);
    gl.viewport(0, 0, depthTextureSize.x, depthTextureSize.y);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, verticesPerCube * 2);

    //Redraw the scene
    draw();
    
});