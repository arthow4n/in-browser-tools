import React, { useState } from 'react';
import {
  PageLayout,
  Panel,
  Button,
  Input,
} from '../shared/components/index.js';
import { PDFDocument } from 'pdf-lib';
import { useAsyncAction } from '../shared/hooks/useAsyncAction.js';

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState('1');
  const [outputs, setOutputs] = useState<
    { url: string; name: string; size: string }[]
  >([]);
  const { isLoading, statusText, isError, runAction } = useAsyncAction();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
  };

  const handleSplit = async () => {
    setOutputs([]);

    await runAction(
      `Processing ${file ? file.name : ''}...`,
      async () => {
        if (!file) {
          throw new Error('Please select a PDF file first.');
        }
        const pagesPerSplit = parseInt(pages, 10);
        if (isNaN(pagesPerSplit) || pagesPerSplit <= 0) {
          throw new Error('Please enter a valid number of pages.');
        }

        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const totalPages = pdfDoc.getPageCount();

        if (totalPages === 0) {
          throw new Error('The selected PDF has no pages.');
        }

        const numChunks = Math.ceil(totalPages / pagesPerSplit);

        const generatedOutputs = [];
        for (let i = 0; i < numChunks; i++) {
          const newPdf = await PDFDocument.create();
          const startPage = i * pagesPerSplit;
          const endPage = Math.min(startPage + pagesPerSplit, totalPages);

          const pageIndices = [];
          for (let j = startPage; j < endPage; j++) {
            pageIndices.push(j);
          }

          const copiedPages = await newPdf.copyPages(pdfDoc, pageIndices);
          copiedPages.forEach((page) => newPdf.addPage(page));

          const pdfBytes = await newPdf.save();
          const blob = new Blob([pdfBytes], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const fileSizeFormatted = formatBytes(blob.size);

          const baseName = file.name.replace(/\.[^/.]+$/, '');
          const downloadName = `${baseName}_part${i + 1}.pdf`;

          generatedOutputs.push({
            url,
            name: downloadName,
            size: fileSizeFormatted,
          });
        }

        setOutputs(generatedOutputs);
        return `Done splitting ${file.name} (${formatBytes(file.size)})! Generated ${numChunks} files.`;
      },
      `Done splitting!`,
    );
  };

  return (
    <PageLayout>
      <Panel title="PDF Splitter">
        <div className="input-group">
          <label htmlFor="pdf-file">Upload PDF file:</label>
          <input
            type="file"
            id="pdf-file"
            accept="application/pdf"
            onChange={handleFileChange}
          />
        </div>
        <Input
          label="Split every X pages:"
          type="number"
          id="pages"
          value={pages}
          min="1"
          onChange={(e) => setPages(e.target.value)}
        />
        <Button onClick={handleSplit} loading={isLoading} id="split-btn">
          Split PDF
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
          {!isLoading && !isError && file && outputs.length === 0
            ? `Input file selected: ${file.name} (${formatBytes(file.size)})`
            : statusText}
        </div>

        {outputs.length > 0 && (
          <ul id="output-list" style={{ marginTop: '1em' }}>
            {outputs.map((out) => (
              <li key={out.name}>
                <a href={out.url} download={out.name}>
                  Download {out.name} ({out.size})
                </a>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </PageLayout>
  );
};
