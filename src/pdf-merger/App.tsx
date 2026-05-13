import React, { useState } from 'react';
import {
  PageLayout,
  Panel,
  Button,
  Input,
} from '../shared/components/index.js';
import { PDFDocument } from 'pdf-lib';
import { useAsyncAction } from '../shared/hooks/useAsyncAction.js';

export const App: React.FC = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const { isLoading, statusText, isError, runAction } = useAsyncAction();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...files]);
    }
    // Clear input so same file can be selected again if needed
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMerge = async () => {
    setOutputUrl(null);

    await runAction(
      'Merging PDFs...',
      async () => {
        if (selectedFiles.length === 0) {
          throw new Error('Please select at least one PDF file.');
        }
        const mergedPdf = await PDFDocument.create();

        for (const file of selectedFiles) {
          const arrayBuffer = await file.arrayBuffer();
          const pdfDoc = await PDFDocument.load(arrayBuffer);
          const copiedPages = await mergedPdf.copyPages(
            pdfDoc,
            pdfDoc.getPageIndices(),
          );
          copiedPages.forEach((page) => {
            mergedPdf.addPage(page);
          });
        }

        const mergedPdfBytes = await mergedPdf.save();
        const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        setOutputUrl(url);
      },
      'Done merging!',
    );
  };

  return (
    <PageLayout>
      <Panel title="PDF Merger">
        <div className="input-group">
          <label htmlFor="pdf-files">Upload PDF files:</label>
          <input
            type="file"
            id="pdf-files"
            accept="application/pdf"
            multiple
            onChange={handleFileChange}
          />
        </div>

        <div style={{ marginTop: '1em' }}>
          <ul id="file-list">
            {selectedFiles.map((file, index) => (
              <li key={index}>
                {file.name}
                <Button
                  variant="danger"
                  style={{ marginLeft: '10px' }}
                  onClick={() => removeFile(index)}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </div>

        <Button
          onClick={handleMerge}
          loading={isLoading}
          id="merge-btn"
          style={{ marginTop: '1em' }}
        >
          Merge PDFs
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

        {outputUrl && (
          <div id="output" style={{ marginTop: '1em' }}>
            <a href={outputUrl} download="merged.pdf">
              Download Merged PDF
            </a>
          </div>
        )}
      </Panel>
    </PageLayout>
  );
};
