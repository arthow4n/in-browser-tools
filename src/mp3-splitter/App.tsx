import React, { useState, useRef } from 'react';
import {
  PageLayout,
  Panel,
  Button,
  Input,
} from '../shared/components/index.js';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { useAsyncAction } from '../shared/hooks/useAsyncAction.js';

export const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [minutes, setMinutes] = useState('30');
  const [outputs, setOutputs] = useState<{ url: string; name: string }[]>([]);

  const ffmpegRef = useRef<FFmpeg | null>(null);
  const { isLoading, statusText, isError, runAction } = useAsyncAction();

  const loadFfmpeg = async () => {
    if (!ffmpegRef.current) {
      ffmpegRef.current = new FFmpeg();
      ffmpegRef.current.on('log', ({ message }) => console.log(message));
    }
    const ffmpeg = ffmpegRef.current;
    if (ffmpeg.loaded) return ffmpeg;

    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(
        `${baseURL}/ffmpeg-core.wasm`,
        'application/wasm',
      ),
    });
    return ffmpeg;
  };

  const handleSplit = async () => {
    setOutputs([]);

    await runAction(
      'Loading FFmpeg...',
      async () => {
        if (!file) {
          throw new Error('Please select a file first.');
        }
        const parsedMinutes = parseInt(minutes, 10);
        if (isNaN(parsedMinutes) || parsedMinutes <= 0) {
          throw new Error('Please enter a valid number of minutes.');
        }

        const ffmpeg = await loadFfmpeg();

        const extMatch = file.name.match(/\.([^.]+)$/);
        const ext = extMatch ? extMatch[1].toLowerCase() : 'mp3';
        const isM4A = ext === 'm4a' || ext === 'mp4';
        const inputFileName = isM4A ? 'input.m4a' : 'input.mp3';

        await ffmpeg.writeFile(inputFileName, await fetchFile(file));

        const seconds = parsedMinutes * 60;
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

        await ffmpeg.exec(execArgs);

        const dir = await ffmpeg.listDir('/');
        const outputFiles = (dir as { name: string; isDir: boolean }[])
          .filter((d) => d.name.startsWith('output') && d.name.endsWith('.mp3'))
          .map((d) => d.name)
          .sort();

        if (outputFiles.length === 0) {
          throw new Error('No output files were generated.');
        }

        const generatedOutputs = [];
        const baseName = file.name.replace(/\.[^/.]+$/, '');

        for (const fileName of outputFiles) {
          const data = await ffmpeg.readFile(fileName);
          const blob = new Blob([data as unknown as BlobPart], {
            type: 'audio/mpeg',
          });
          const url = URL.createObjectURL(blob);

          const partMatch = fileName.match(/output(\d{3})\.mp3/);
          const partIndex = partMatch ? parseInt(partMatch[1], 10) + 1 : 1;
          const downloadName = `${baseName}_part${partIndex}.mp3`;

          generatedOutputs.push({ url, name: downloadName });
          await ffmpeg.deleteFile(fileName);
        }

        setOutputs(generatedOutputs);
        await ffmpeg.deleteFile(inputFileName);
      },
      'Done!',
    );
  };

  return (
    <PageLayout>
      <Panel title="MP3 Splitter">
        <Input
          type="file"
          id="mp3-file"
          label="Upload MP3 or M4A file:"
          accept="audio/mpeg,audio/mp4,audio/x-m4a,.m4a"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <Input
          label="Split every X minutes:"
          type="number"
          id="minutes"
          value={minutes}
          min="1"
          onChange={(e) => setMinutes(e.target.value)}
        />
        <Button onClick={handleSplit} loading={isLoading} id="split-btn">
          Split MP3
        </Button>

        <div
          id="status"
          className="status"
          style={{
            marginTop: '1em',
            wordWrap: 'break-word',
            color: isError ? 'red' : 'green',
          }}
        >
          {statusText}
        </div>

        {outputs.length > 0 && (
          <ul id="output-list" style={{ marginTop: '1em' }}>
            {outputs.map((out) => (
              <li key={out.name}>
                <a href={out.url} download={out.name}>
                  Download {out.name}
                </a>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </PageLayout>
  );
};
