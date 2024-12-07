//by using sampler2DShadow, while WebGL won’t attempt to smooth out the scaled pixels of your shadow map, it does smooth out the rendered pixels in-between the shadowed and lit areas.

//MAIN

//vertex and fragment shaders for the light point of view

//Light POV

//vertexShader for shadow map generation
//aPosition: positions of vertices
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

float ambientLight = 0.25;

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

let currPrimitive = "parallelepiped";

//Context creation for WebGL
const canvas = document.querySelector('canvas');
const gl = canvas.getContext('webgl2');

//Compiling and executing the shader program
const program = createProgram(gl, vertexShaderSrc, fragmentShaderSrc);
const depthProgram = createProgram(gl, depthVertexShader, depthFragmentShader);

//Depth test enabled so that overlayed items are properly rendered 
gl.enable(gl.DEPTH_TEST);

//bias improvement
//gl.enable(gl.CULL_FACE);

//Setting initial origin point
let origin = new DOMPoint(0, 0, 0);

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
let projection = createPerspective(Math.PI / 3, canvas.width / canvas.height, 0.1, 50);
let modelViewProjection = projection.multiply(view);

//Passing MVP to the program shader
let projectionLoc = gl.getUniformLocation(program, 'modelViewProjection');
gl.uniformMatrix4fv(projectionLoc, false, modelViewProjection.toFloat32Array());

let normalMatrix = calculateNormalMatrix(view.toFloat32Array());

let normalMatrixLoc = gl.getUniformLocation(program, 'normalMatrix');
gl.uniformMatrix4fv(normalMatrixLoc, false, new Float32Array(normalMatrix));


// Create cubes and bind their data
let width_cube=getRandomFloat(0.1, 0.7);
let height_cube=getRandomFloat(0.25, 0.55);
let depth_cube=getRandomFloat(0.1, 0.4);
console.log("-----------------------NEW CUBE-------------------------------");
console.log("Current width_cube: "+ width_cube.toFixed(2));
console.log("Current height_cube: "+ height_cube.toFixed(2));
console.log("Current depth_cube: "+ depth_cube.toFixed(2));

//avoids cube to be rendered inside and below the base cube
let baseCubeHeight = 0.01; 
let upperCubeYPosition = baseCubeHeight + height_cube;;


let vertices = 36;
let cubes = new Float32Array([
	...createCubeWithNormals(1, baseCubeHeight, 1, 0, 0, 0),
	...createCubeWithNormals(width_cube, height_cube, depth_cube, 0, upperCubeYPosition, 0)
]);
console.log(cubes.length);

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
function draw(primitive) {
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// Render shadow map to depth texture
	gl.useProgram(depthProgram);
	//gl.cullFace(gl.FRONT);
	gl.bindFramebuffer(gl.FRAMEBUFFER, depthFramebuffer);
	gl.viewport(0, 0, depthTextureSize.x, depthTextureSize.y);
	if(primitive == "parallelepiped") {
		gl.drawArrays(gl.TRIANGLES, 0, vertices * 2); //two cubes so 36 * 2
	}
	else {
		gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 6);
	}
	

	// Set depth texture and render scene to canvas
	gl.useProgram(program);
	//gl.cullFace(gl.BACK);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
	gl.bindTexture(gl.TEXTURE_2D, depthTexture);
	gl.uniform1i(shadowMapLocation, 0);
	if(primitive == "parallelepiped") {
		gl.drawArrays(gl.TRIANGLES, 0, vertices * 2);
	}
	else {
		gl.drawArrays(gl.TRIANGLES, 0, vertices.length /6);
	}
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

	normalMatrix = calculateNormalMatrix(view.toFloat32Array());

	gl.uniformMatrix4fv(normalMatrixLoc, false, new Float32Array(normalMatrix));

	console.log(`Canvas size: ${canvas.width}x${canvas.height}`);
	console.log(`Viewport size: ${gl.getParameter(gl.VIEWPORT)}`);
	

	draw(currPrimitive);
}

// Adapt canvas to the window
resizeCanvasToWindow();
    
//Draw the scene
draw(currPrimitive);

//Show settings on UI
displaySettings(cameraPosition, inverseLightDirection, lightIntensity);

//resize all everytime window is resized or moved to another screen
window.addEventListener('resize', resizeCanvasToWindow);

//change camera position values
changeCamera(cameraPosition);

//change light direction values
changeLightDir(inverseLightDirection);

//change light intensity 
document.getElementById('lightIntV').addEventListener('input', (e) => {
	lightIntensity = parseFloat(e.target.value);
	document.getElementById('lightInt').innerText = lightIntensity.toFixed(2);
});

//apply camera changes
applyCameraChanges(gl, canvas, cameraPosition, projection, origin, normalMatrixLoc, projectionLoc, draw, currPrimitive); 

//apply lightDir changes
applyLightDirChanges(gl, canvas, inverseLightDirection, lightPovProjection, origin, lightDirectionLoc, depthProgram, program, lightPovMvpDepthLocation, lightPovMvpRenderLocation, textureSpaceConversion, depthFramebuffer, depthTextureSize, draw, currPrimitive, vertices);

//apply light Int change
document.getElementById('applyLightIntensity').addEventListener('click', () => {

	gl.useProgram(program);
	gl.uniform1f(lightIntensityLoc, lightIntensity);  // update uniform var in shader


	if(window.innerWidth != canvas.width || window.innerHeight != canvas.height ) {
		//Resize and redraw
		resizeCanvasToWindow();
	}
	else {
		//Redraw the scene
		draw(currPrimitive);
	}
	console.log('Light intensity updated:', lightIntensity);
});

document.getElementById('RandParallelepiped').addEventListener('click', () => {

	currPrimitive="parallelepiped";

	// new random dimensions for the cube
    width_cube = getRandomFloat(0.1, 0.7);
    height_cube = getRandomFloat(0.25, 0.55);
    depth_cube = getRandomFloat(0.1, 0.4);

    console.log("-----------------------NEW CUBE-------------------------------");
	console.log("Current width_cube: "+ width_cube.toFixed(2));
	console.log("Current height_cube: "+ height_cube.toFixed(2));
	console.log("Current depth_cube: "+ depth_cube.toFixed(2));


	//avoids cube to be rendered inside and below the base cube 
	upperCubeYPosition = baseCubeHeight + height_cube;

	let maxOffsetX = (1 - width_cube) / 2; // Limita il movimento lungo l'asse X
	let maxOffsetZ = (1 - depth_cube) / 2; // Limita il movimento lungo l'asse Z

	let cubePositionX = getRandomFloat(-maxOffsetX, maxOffsetX);
	let cubePositionZ = getRandomFloat(-maxOffsetZ, maxOffsetZ);


    // new vertices for the cube
	vertices = 36;
    cubes = new Float32Array([
        ...createCubeWithNormals(1, baseCubeHeight, 1, 0, 0, 0), // base plan
        ...createCubeWithNormals(width_cube, height_cube, depth_cube, cubePositionX, upperCubeYPosition, cubePositionZ) // new cube
    ]);

    // Updating the buffer with the new cube
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, cubes, gl.STATIC_DRAW);

	// Update the shadow map
    gl.useProgram(depthProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, depthFramebuffer);
    gl.viewport(0, 0, depthTextureSize.x, depthTextureSize.y);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, vertices * 2);

	if(window.innerWidth != canvas.width || window.innerHeight != canvas.height ) {
		//Resize and redraw
		resizeCanvasToWindow();
	}
	else {
		//Redraw the scene
		draw(currPrimitive);
	}
});

document.getElementById('RandSphere').addEventListener('click', () => {
	currPrimitive="sphere";

    // Genera un raggio casuale per la sfera
    let sphereRadius = getRandomFloat(0.1, 0.5);

    // Calcola la posizione della sfera sopra la base
    let spherePositionY = baseCubeHeight / 2 + sphereRadius;

    // Limita il movimento della sfera lungo X e Z per rimanere sopra la base
    let maxOffsetX = 1 - sphereRadius * 2; // Limita il movimento lungo X
    let maxOffsetZ = 1 - sphereRadius * 2; // Limita il movimento lungo Z

    let spherePositionX = getRandomFloat(-maxOffsetX / 2, maxOffsetX / 2);
    let spherePositionZ = getRandomFloat(-maxOffsetZ / 2, maxOffsetZ / 2);

    // Genera i vertici per la base e per la sfera
    let baseVertices = createCubeWithNormals(1, baseCubeHeight, 1, 0, 0, 0); // Base
    let sphereVertices = createSphere(sphereRadius, 32, spherePositionX, spherePositionY, spherePositionZ); // Sfera

    vertices = new Float32Array([...baseVertices, ...sphereVertices]);
	console.log("vertices length for sphere: " + vertices.length);

    console.log("-----------------------NEW SPHERE-------------------------------");
    console.log("Current radius: " + sphereRadius.toFixed(2));
    console.log("Sphere position: (" + spherePositionX.toFixed(2) + ", " + spherePositionY.toFixed(2) + ", " + spherePositionZ.toFixed(2) + ")");

    // Aggiorna il buffer con i nuovi vertici
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    // Aggiorna la shadow map
    gl.useProgram(depthProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, depthFramebuffer);
    gl.viewport(0, 0, depthTextureSize.x, depthTextureSize.y);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 6);

    // Ridisegna la scena
    if (window.innerWidth != canvas.width || window.innerHeight != canvas.height) {
        resizeCanvasToWindow();
    } else {
        draw(currPrimitive);
    }
});

