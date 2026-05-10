import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { runWithUIState } from '../shared/ui-utils.js';

const fileInput = document.getElementById('mp3-file');
const minutesInput = document.getElementById('minutes');
const splitBtn = document.getElementById('split-btn');
const statusDiv = document.getElementById('status');
const outputList = document.getElementById('output-list');

if (!(fileInput instanceof HTMLInputElement))
  throw new Error('File input not found');
if (!(minutesInput instanceof HTMLInputElement))
  throw new Error('Minutes input not found');
if (!(splitBtn instanceof HTMLButtonElement))
  throw new Error('Split button not found');
if (!(statusDiv instanceof HTMLDivElement))
  throw new Error('Status div not found');
if (!(outputList instanceof HTMLUListElement))
  throw new Error('Output list not found');

const ffmpeg = new FFmpeg();

ffmpeg.on('log', ({ message }) => {
  console.log(message);
});

const loadFfmpeg = async () => {
  if (ffmpeg.loaded) return;

  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });
};

splitBtn.addEventListener('click', async () => {
  const file = fileInput.files?.[0];
  if (!file) {
    statusDiv.textContent = 'Please select a file first.';
    return;
  }

  const minutes = parseInt(minutesInput.value, 10);
  if (isNaN(minutes) || minutes <= 0) {
    statusDiv.textContent = 'Please enter a valid number of minutes.';
    return;
  }

  outputList.innerHTML = '';

  await runWithUIState(
    splitBtn,
    statusDiv,
    'Loading FFmpeg...',
    async () => {
      await loadFfmpeg();

      const extMatch = file.name.match(/\.([^.]+)$/);
      const ext = extMatch ? extMatch[1].toLowerCase() : 'mp3';
      const isM4A = ext === 'm4a' || ext === 'mp4';
      const inputFileName = isM4A ? 'input.m4a' : 'input.mp3';

      statusDiv.textContent = 'Writing file to memory...';
      await ffmpeg.writeFile(inputFileName, await fetchFile(file));

      statusDiv.textContent = 'Splitting...';

      // Calculate seconds
      const seconds = minutes * 60;

      const execArgs = ['-i', inputFileName];

      if (!isM4A) {
        execArgs.push('-c', 'copy');
      }

      execArgs.push(
        '-map',
        '0:a',
        '-segment_time',
        seconds.toString(),
        '-f',
        'segment',
        'output%03d.mp3',
      );

      // Use segment muxer to split
      await ffmpeg.exec(execArgs);

      statusDiv.textContent = 'Done splitting! Preparing downloads...';

      const dir = await ffmpeg.listDir('/');
      // Type d.name exists in the output of listDir
      const outputFiles = (dir as { name: string; isDir: boolean }[])
        .filter((d) => d.name.startsWith('output') && d.name.endsWith('.mp3'))
        .map((d) => d.name)
        .sort();

      if (outputFiles.length === 0) {
        throw new Error('No output files were generated.');
      } else {
        statusDiv.textContent = `Generated ${outputFiles.length} files.`;
        for (const fileName of outputFiles) {
          const data = await ffmpeg.readFile(fileName);
          // FFmpeg v0.12 readFile returns a Uint8Array
          const blob = new Blob([data as Uint8Array], { type: 'audio/mpeg' });
          const url = URL.createObjectURL(blob);

          const li = document.createElement('li');
          const a = document.createElement('a');
          a.href = url;

          const baseName = file.name.replace(/\.[^/.]+$/, '');
          const partMatch = fileName.match(/output(\d{3})\.mp3/);
          const partIndex = partMatch ? parseInt(partMatch[1], 10) + 1 : 1;
          const downloadName = `${baseName}_part${partIndex}.mp3`;

          a.download = downloadName;
          a.textContent = `Download ${downloadName}`;
          li.appendChild(a);
          outputList.appendChild(li);

          await ffmpeg.deleteFile(fileName);
        }
      }

      await ffmpeg.deleteFile(inputFileName);
    },
    'Done!',
  );
});
