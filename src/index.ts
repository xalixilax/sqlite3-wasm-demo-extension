interface LogMessage {
  type: 'log';
  payload: {
    cssClass: string;
    args: string[];
  };
}

const logHtml = function (cssClass: string, ...args: string[]): void {
  const ln = document.createElement('div');
  if (cssClass) ln.classList.add(cssClass);
  ln.append(document.createTextNode(args.join(' ')));
  document.body.append(ln);
};

const worker = new Worker('worker.js?sqlite3.dir=jswasm');
worker.onmessage = function ({ data }: MessageEvent<LogMessage>): void {
  switch (data.type) {
    case 'log':
      logHtml(data.payload.cssClass, ...data.payload.args);
      break;
    default:
      logHtml('error', 'Unhandled message:', data.type);
  }
};

export {};
