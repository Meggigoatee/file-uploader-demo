export interface UploadResult { state: 'success' | 'rejected' | 'failed' | 'unconfirmed'; message: string; stop: boolean }

export function sendFile(file: File, progress: (percent?: number) => void, confirming: () => void): Promise<UploadResult> {
  return new Promise(resolve => {
    const xhr = new XMLHttpRequest();
    const unknown = () => resolve({ state:'unconfirmed', message:'완료 확인 실패 · 이미 저장됐을 수 있습니다. 수동 재시도 시 중복 저장될 수 있습니다.', stop:true });
    xhr.open('POST','/api/uploads');
    xhr.timeout = 60000;
    xhr.upload.onprogress = event => {
      progress(event.lengthComputable ? Math.min(100,Math.floor(event.loaded / event.total * 100)) : undefined);
      if (event.lengthComputable && event.loaded === event.total) confirming();
    };
    xhr.upload.onload = confirming;
    xhr.onerror = unknown; xhr.ontimeout = unknown; xhr.onabort = unknown;
    xhr.onload = () => {
      let data: any;
      try { data = JSON.parse(xhr.responseText); } catch { unknown(); return; }
      if (xhr.status === 201 && typeof data.id === 'string' && /^[0-9a-f-]{36}$/.test(data.id) && data.size === file.size && typeof data.requestId === 'string') {
        resolve({state:'success',message:'업로드 완료',stop:false});
      } else if (typeof data?.error?.code === 'string' && typeof data.error.message === 'string') {
        const individual = [400,413,415,422].includes(xhr.status);
        resolve({state:individual ? 'rejected' : 'failed',message:data.error.message,stop:!individual});
      } else unknown();
    };
    const form = new FormData(); form.set('file',file); xhr.send(form);
  });
}
