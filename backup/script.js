document.getElementById('userImage').addEventListener('change', function(event) {
    const [file] = event.target.files;
    if (file) {
        document.getElementById('previewImage').src = URL.createObjectURL(file);
        document.getElementById('previewImage').style.display = 'block';
    }
});

document.getElementById('transformButton').addEventListener('click', async () => {
    const userImageFile = document.getElementById('userImage').files[0];
    const disfraz = document.getElementById('disfrazSelector').value;
    const sound = document.getElementById('soundSelector').value;
    const loadingMessage = document.getElementById('loadingMessage');
    const transformedImage = document.getElementById('transformedImage');
    const halloweenAnimation = document.getElementById('halloweenAnimation');
    const halloweenSound = document.getElementById('halloweenSound');

    if (!userImageFile) {
        alert('Por favor, sube una imagen.');
        return;
    }

    loadingMessage.style.display = 'block';
    transformedImage.style.display = 'none';
    halloweenAnimation.style.display = 'none';
    halloweenSound.style.display = 'none';

    const formData = new FormData();
    formData.append('image', userImageFile);
    formData.append('disfraz', disfraz);
    formData.append('sound', sound);

    try {
        const response = await fetch('/transform', { // Endpoint de tu backend
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.transformed_image_url) {
            transformedImage.src = data.transformed_image_url;
            transformedImage.style.display = 'block';
        }
        if (data.animation_url) {
            halloweenAnimation.src = data.animation_url;
            halloweenAnimation.style.display = 'block';
            halloweenAnimation.load(); // Carga el video
            halloweenAnimation.play(); // Reproduce automáticamente
        }
        if (data.sound_url) {
            halloweenSound.src = data.sound_url;
            halloweenSound.style.display = 'block';
            halloweenSound.load(); // Carga el audio
            halloweenSound.play(); // Reproduce automáticamente
        }

    } catch (error) {
        console.error('Error al transformar:', error);
        alert('Ocurrió un error en la transformación. Inténtalo de nuevo.');
    } finally {
        loadingMessage.style.display = 'none';
    }
});