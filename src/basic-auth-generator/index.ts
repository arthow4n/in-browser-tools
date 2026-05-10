const inputUsername = document.getElementById('input-username');
const inputPassword = document.getElementById('input-password');
const inputUrl = document.getElementById('input-url');
const urlError = document.getElementById('url-error');

const outputCredentials = document.getElementById('output-credentials');
const outputFullUrl = document.getElementById('output-full-url');

if (!(inputUsername instanceof HTMLInputElement))
  throw new Error('Username input not found');
if (!(inputPassword instanceof HTMLInputElement))
  throw new Error('Password input not found');
if (!(inputUrl instanceof HTMLInputElement))
  throw new Error('URL input not found');
if (!(urlError instanceof HTMLSpanElement))
  throw new Error('URL error span not found');
if (!(outputCredentials instanceof HTMLDivElement))
  throw new Error('Output credentials div not found');
if (!(outputFullUrl instanceof HTMLDivElement))
  throw new Error('Output full URL div not found');

function updateOutput() {
  const username = inputUsername.value;
  const password = inputPassword.value;
  const urlString = inputUrl.value;

  const encodedUsername = encodeURIComponent(username);
  const encodedPassword = encodeURIComponent(password);

  const credentials = `${encodedUsername}:${encodedPassword}`;

  // Only show the colon if either username or password is provided, or just show empty if both are empty
  if (username === '' && password === '') {
    outputCredentials.textContent = '';
  } else {
    outputCredentials.textContent = credentials;
  }

  urlError.textContent = '';
  outputFullUrl.textContent = '';

  if (urlString) {
    try {
      const url = new URL(urlString);

      // Update URL with credentials
      // Note: The URL object in JS automatically encodes the username and password properties
      if (username !== '' || password !== '') {
        url.username = username;
        url.password = password;
      }

      outputFullUrl.textContent = url.href;
    } catch (e) {
      urlError.textContent = 'Invalid URL format';
    }
  }
}

inputUsername.addEventListener('input', updateOutput);
inputPassword.addEventListener('input', updateOutput);
inputUrl.addEventListener('input', updateOutput);

// Initial state
updateOutput();
