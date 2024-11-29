//STEP 0: DRAW TWO CUBES WITH CAMERA VIEW MOVABLE------------------------------------------------------------------------

/*

//MAIN
document.getElementById('StartDemo').addEventListener('click', () => {

	//Version specification is needed for Web GL 2.0 and GLSL ES 3.0 (to avoid ambiguity)
	//Also 'layout (location=x)' is needed and substitutes 'attribute', which is deprecated
	const vertexShaderSrc = `#version 300 es

	layout(location=0) in vec4 aPosition;
	layout(location=1) in vec3 aColor;

	uniform mat4 modelViewProjection;

	out vec3 vColor;

	void main()
	{
		vColor = aColor;
		gl_Position = modelViewProjection * aPosition;
	}`;


	const fragmentShaderSrc = `#version 300 es
	precision mediump float;

	in vec3 vColor;

	out vec3 fragColor;

	void main()
	{
	fragColor = vColor;
	}`;

	//Context creation for WebGL
	const gl = document.querySelector('canvas').getContext('webgl2');

	//Compiling and executing the shader program
	const program = createProgram(gl, vertexShaderSrc, fragmentShaderSrc);
	gl.useProgram(program);

	//Depth test enabled so that overlayed items are properly rendered 
	gl.enable(gl.DEPTH_TEST);

	//Setting origin point
	const origin = new DOMPoint(0, 0, 0);

	// Set Camera MVP Matrix (camera Position can vary)
	let cameraPosition = new DOMPoint(1, 1, 2);   //initially here
	let view = createLookAt(cameraPosition, origin);
	let projection = createPerspective(Math.PI / 3, 16 / 9, 0.1, 10);
	let modelViewProjection = projection.multiply(view);

	//Passing MVP to the program shader
	let projectionLoc = gl.getUniformLocation(program, 'modelViewProjection');
	gl.uniformMatrix4fv(projectionLoc, false, modelViewProjection.toFloat32Array());


	// Create cubes and bind their data
	const verticesPerCube = 6 * 6;
	const cubes = new Float32Array([
	...createMultiColorCube(1, 0.1, 1, 0, 0, 0),
	...createMultiColorCube(0.3, 0.5, 0.1, 0, 0, 0)
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

	//Rendering
	function draw() {
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	
		gl.drawArrays(gl.TRIANGLES, 0, verticesPerCube * 2);
	}
    

    
    draw();

	//Show x, y, z values for the current camera
	document.getElementById('valueX').innerText = cameraPosition.x.toFixed(2);
	document.getElementById('valueY').innerText = cameraPosition.y.toFixed(2);
	document.getElementById('valueZ').innerText = cameraPosition.z.toFixed(2);

	// Disable the "Start Demo" button after it is clicked
    document.getElementById('StartDemo').disabled = true;

    console.log('Demo started');

	document.getElementById('cameraX').addEventListener('input', (e) => {
		cameraPosition.x = parseFloat(e.target.value);
		document.getElementById('valueX').innerText = cameraPosition.x.toFixed(2);
		
	});
	
	document.getElementById('cameraY').addEventListener('input', (e) => {
		cameraPosition.y = parseFloat(e.target.value);
		document.getElementById('valueY').innerText = cameraPosition.y.toFixed(2);
		
	});
	
	document.getElementById('cameraZ').addEventListener('input', (e) => {
		cameraPosition.z = parseFloat(e.target.value);
		document.getElementById('valueZ').innerText = cameraPosition.z.toFixed(2);
	});
	
	document.getElementById('applyCamera').addEventListener('click', () => {
		view = createLookAt(cameraPosition, origin);
		modelViewProjection = projection.multiply(view);
	
		// Passa la nuova matrice MVP allo shader
		gl.uniformMatrix4fv(projectionLoc, false, modelViewProjection.toFloat32Array());
	
		// Ridisegna la scena
		draw();
		console.log('Camera settings applied:', cameraPosition);
	});
});

*/

//Step 1: SHADOW MAP V1 (LIGHT AND CAMERA MOVABLE)

//MAIN
document.getElementById('StartDemo').addEventListener('click', () => {

	//Create new vertex and fragment shaders for the light point of view (matrix will be for it)

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
	layout(location=1) in vec3 aColor;

	uniform mat4 modelViewProjection;
	uniform mat4 lightPovMvp;

	out vec3 vColor;
	out vec4 positionFromLightPov;

	void main()
	{
		vColor = aColor;
		gl_Position = modelViewProjection * aPosition;
		positionFromLightPov = lightPovMvp * aPosition;
	}`;

	const fragmentShaderSrc = `#version 300 es
	precision mediump float;

	in vec3 vColor;
	in vec4 positionFromLightPov;

	uniform mediump sampler2DShadow shadowMap;

	out vec3 fragColor;

	float ambientLight = 0.5;

	void main()
	{
		vec4 lightPovPositionInTexture = positionFromLightPov * 0.5 + 0.5;

		//avoids self shadowing and artifacts on the scene
  		float bias = 0.004;
  		vec3 biased = vec3(lightPovPositionInTexture.xy, lightPovPositionInTexture.z - bias);

		float hitByLight = texture(shadowMap, biased);
		float litPercent = max(hitByLight, ambientLight);
		fragColor = vColor * litPercent;
	}`;

	//Context creation for WebGL
	const gl = document.querySelector('canvas').getContext('webgl2');

	//Compiling and executing the shader program
	const program = createProgram(gl, vertexShaderSrc, fragmentShaderSrc);
	const depthProgram = createProgram(gl, depthVertexShader, depthFragmentShader);
	
	//Depth test enabled so that overlayed items are properly rendered 
	gl.enable(gl.DEPTH_TEST);

	//Setting origin point
	const origin = new DOMPoint(0, 0, 0);

	// Set Light MVP Matrix (light direction can vary)
	let inverseLightDirection = new DOMPoint(-0.5, 2, -2);
    let lightPovProjection = createOrtho(-1,1,-1,1,0,4);
	let lightPovView = createLookAt(inverseLightDirection, origin);
	let lightPovMvp = lightPovProjection.multiply(lightPovView);

	let lightPovMvpDepthLocation = gl.getUniformLocation(depthProgram, 'lightPovMvp');
	gl.useProgram(depthProgram);
	gl.uniformMatrix4fv(lightPovMvpDepthLocation, false, lightPovMvp.toFloat32Array());

	let lightPovMvpRenderLocation = gl.getUniformLocation(program, 'lightPovMvp');
	gl.useProgram(program);
	gl.uniformMatrix4fv(lightPovMvpRenderLocation, false, lightPovMvp.toFloat32Array());

	
	// Set Camera MVP Matrix (camera Position can vary)
	let cameraPosition = new DOMPoint(1, 1, 2);   //initially here
	let view = createLookAt(cameraPosition, origin);
	let projection = createPerspective(Math.PI / 3, 16 / 9, 0.1, 10);
	let modelViewProjection = projection.multiply(view);

	//Passing MVP to the program shader
	let projectionLoc = gl.getUniformLocation(program, 'modelViewProjection');
	gl.uniformMatrix4fv(projectionLoc, false, modelViewProjection.toFloat32Array());


	// Create cubes and bind their data
	const verticesPerCube = 6 * 6;
	const cubes = new Float32Array([
	...createMultiColorCube(1, 0.1, 1, 0, 0, 0),
	...createMultiColorCube(0.3, 0.5, 0.1, 0, 0, 0)
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
	// Imposta il filtro su NEAREST
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

	//Rendering
	function draw() {
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		// Render shadow map to depth texture
		gl.useProgram(depthProgram);
		gl.bindFramebuffer(gl.FRAMEBUFFER, depthFramebuffer);
		gl.viewport(0, 0, depthTextureSize.x, depthTextureSize.y);
		gl.drawArrays(gl.TRIANGLES, 0, verticesPerCube * 2);

		// Set depth texture and render scene to canvas
		gl.useProgram(program);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
		gl.bindTexture(gl.TEXTURE_2D, depthTexture);
		gl.uniform1i(shadowMapLocation, 0);
		gl.drawArrays(gl.TRIANGLES, 0, verticesPerCube * 2);
	}
    

    
    draw();

	//Show x, y, z values for the current camera
	document.getElementById('valueX').innerText = cameraPosition.x.toFixed(2);
	document.getElementById('valueY').innerText = cameraPosition.y.toFixed(2);
	document.getElementById('valueZ').innerText = cameraPosition.z.toFixed(2);

	document.getElementById('lightvX').innerText = inverseLightDirection.x.toFixed(2);
	document.getElementById('lightvY').innerText = inverseLightDirection.y.toFixed(2);
	document.getElementById('lightvZ').innerText = inverseLightDirection.z.toFixed(2);

	// Disable the "Start Demo" button after it is clicked
    document.getElementById('StartDemo').disabled = true;

    console.log('Demo started');

	//change camera position values
	document.getElementById('cameraX').addEventListener('input', (e) => {
		cameraPosition.x = parseFloat(e.target.value);
		document.getElementById('cameraX').innerText = cameraPosition.x.toFixed(2);
		
	});
	
	document.getElementById('cameraY').addEventListener('input', (e) => {
		cameraPosition.y = parseFloat(e.target.value);
		document.getElementById('valueY').innerText = cameraPosition.y.toFixed(2);
		
	});
	
	document.getElementById('cameraZ').addEventListener('input', (e) => {
		cameraPosition.z = parseFloat(e.target.value);
		document.getElementById('valueZ').innerText = cameraPosition.z.toFixed(2);
	});

	//change light direction values
	document.getElementById('lightX').addEventListener('input', (e) => {
		inverseLightDirection.x = parseFloat(e.target.value);
		document.getElementById('lightvX').innerText = inverseLightDirection.x.toFixed(2);
		
	});
	
	document.getElementById('lightY').addEventListener('input', (e) => {
		inverseLightDirection.y = parseFloat(e.target.value);
		document.getElementById('lightvY').innerText = inverseLightDirection.y.toFixed(2);
		
	});
	
	document.getElementById('lightZ').addEventListener('input', (e) => {
		inverseLightDirection.z = parseFloat(e.target.value);
		document.getElementById('lightvZ').innerText = inverseLightDirection.z.toFixed(2);
	});

	//apply changes
	document.getElementById('applyCamera').addEventListener('click', () => {
		view = createLookAt(cameraPosition, origin);
		modelViewProjection = projection.multiply(view);
	
		gl.uniformMatrix4fv(projectionLoc, false, modelViewProjection.toFloat32Array());
	
		draw();
		console.log('Camera settings applied:', cameraPosition);
	});

	document.getElementById('applyLight').addEventListener('click', () => {

		//Create new light MVP
		lightPovView = createLookAt(inverseLightDirection, origin);
		lightPovMvp = lightPovProjection.multiply(lightPovView);
	 
		// Pass it to light rendering
		gl.useProgram(depthProgram);
		gl.uniformMatrix4fv(lightPovMvpDepthLocation, false, lightPovMvp.toFloat32Array());
	 
		gl.useProgram(program);
		gl.uniformMatrix4fv(lightPovMvpRenderLocation, false, lightPovMvp.toFloat32Array());
		
		// generete the new shadow map with the new lightdirection
		gl.bindFramebuffer(gl.FRAMEBUFFER, depthFramebuffer);
		gl.viewport(0, 0, depthTextureSize.x, depthTextureSize.y);
		gl.clear(gl.DEPTH_BUFFER_BIT);
		gl.drawArrays(gl.TRIANGLES, 0, verticesPerCube * 2);
	 
		//draw updated scene
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
		
		draw();
		console.log('Light settings applied:', inverseLightDirection);
	});
});
