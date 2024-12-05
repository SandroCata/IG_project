const verticesPerCube2 = 6 * 6;

function displaySettings(camera, light, lightInt) {
    document.getElementById('valueX').innerText = camera.x.toFixed(2);
	document.getElementById('valueY').innerText = camera.y.toFixed(2);
	document.getElementById('valueZ').innerText = camera.z.toFixed(2);

	document.getElementById('lightvX').innerText = light.x.toFixed(2);
	document.getElementById('lightvY').innerText = light.y.toFixed(2);
	document.getElementById('lightvZ').innerText = light.z.toFixed(2);

	document.getElementById('lightInt').innerText = lightInt.toFixed(2);
}

function changeCamera(camera) {
    //change camera position values
	document.getElementById('cameraX').addEventListener('input', (e) => {
		camera.x = parseFloat(e.target.value);
		document.getElementById('valueX').innerText = camera.x.toFixed(2);
				
	});
			
	document.getElementById('cameraY').addEventListener('input', (e) => {
		camera.y = parseFloat(e.target.value);
		document.getElementById('valueY').innerText = camera.y.toFixed(2);
				
	});
			
	document.getElementById('cameraZ').addEventListener('input', (e) => {
		camera.z = parseFloat(e.target.value);
		document.getElementById('valueZ').innerText = camera.z.toFixed(2);
	});
}

function changeLightDir(lightDir) {
    document.getElementById('lightX').addEventListener('input', (e) => {
        lightDir.x = parseFloat(e.target.value);
        document.getElementById('lightvX').innerText = lightDir.x.toFixed(2);
        
    });
    
    document.getElementById('lightY').addEventListener('input', (e) => {
        lightDir.y = parseFloat(e.target.value);
        document.getElementById('lightvY').innerText = lightDir.y.toFixed(2);
        
    });
    
    document.getElementById('lightZ').addEventListener('input', (e) => {
        lightDir.z = parseFloat(e.target.value);
        document.getElementById('lightvZ').innerText = lightDir.z.toFixed(2);
    });
}

function applyCameraChanges(gl, canvas, cameraPos, proj, orig, normalMatrixLoc, projectionLoc, draw) {
    document.getElementById('applyCamera').addEventListener('click', () => {
        view = createLookAt(cameraPos, orig);
        modelViewProjection = proj.multiply(view);

        let normalMatrix = calculateNormalMatrix(view.toFloat32Array());

        
        gl.uniformMatrix4fv(normalMatrixLoc, false, new Float32Array(normalMatrix));
    
        gl.uniformMatrix4fv(projectionLoc, false, modelViewProjection.toFloat32Array());


        if(window.innerWidth != canvas.width || window.innerHeight != canvas.height ) {
            //Resize and redraw
            resizeCanvasToWindow();
        }
        else {
            //Redraw the scene
            draw();
        }
        console.log('Camera settings applied:', cameraPos);
    });
}

function applyLightDirChanges(gl, canvas, lightDir, lightProj, origin, lightDirectionLoc, depthProgram, program, lightPovMvpDepthLocation, lightPovMvpRenderLocation, textureSpaceConversion, depthFramebuffer, depthTextureSize, draw) {
    document.getElementById('applyLight').addEventListener('click', () => {

        //Create new light MVP
        gl.uniform3fv(lightDirectionLoc, [lightDir.x, lightDir.y, lightDir.z]);
        let lightPovView = createLookAt(lightDir, origin);
        let lightPovMvp = lightProj.multiply(lightPovView);

        gl.useProgram(depthProgram);
        gl.uniformMatrix4fv(lightPovMvpDepthLocation, false, lightPovMvp.toFloat32Array());

        gl.useProgram(program);
        let textureSpaceMvp = textureSpaceConversion.multiply(lightPovMvp);
        gl.uniformMatrix4fv(lightPovMvpRenderLocation, false, textureSpaceMvp.toFloat32Array());


        // Pass it to light rendering
        gl.useProgram(depthProgram);
        // generete the new shadow map with the new lightdirection
        gl.bindFramebuffer(gl.FRAMEBUFFER, depthFramebuffer);
        gl.viewport(0, 0, depthTextureSize.x, depthTextureSize.y);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, verticesPerCube2 * 2);
        
        gl.useProgram(program);
        //draw updated scene
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        //gl.uniform1f(lightIntensityLoc, lightIntensity);  // Aggiorna l'uniform nello shader

        if(window.innerWidth != canvas.width || window.innerHeight != canvas.height ) {
            //Resize and redraw
            resizeCanvasToWindow();
        }
        else {
            //Redraw the scene
            draw();
        }
        console.log('Light settings applied:', lightDir);
    });
}