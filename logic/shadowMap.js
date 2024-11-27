//STEP 0: DRAW TWO CUBES------------------------------------------------------------------------

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


//Step 1: Add Shadow Map (render from the point of view of light rather than the light)

