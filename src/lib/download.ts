export function downloadHtmlFile(data: any[], filename: string) {
  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <title>My Saved Reddit Posts</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; color: #333; background-color: #f9f9f9; }
    h1 { color: #1a1a1b; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-bottom: 30px; }
    .post { border: 1px solid #e1e1e1; background-color: #fff; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .post-title { font-size: 1.8em; margin-bottom: 10px; color: #1a1a1b; line-height: 1.3; }
    .subreddit { color: #ff4500; font-weight: bold; font-size: 0.9em; margin-bottom: 15px; display: block; }
    .summary { background: #e6f2ff; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #007bff; }
    .summary strong { color: #0056b3; }
    .content { margin-top: 15px; color: #555; white-space: pre-wrap; }
    .post-link { display: inline-block; margin-top: 15px; color: #007bff; text-decoration: none; font-weight: 500; }
    .post-link:hover { text-decoration: underline; }
    .no-posts { text-align: center; color: #777; font-size: 1.2em; margin-top: 50px; }
  </style>
</head>
<body>
  <h1>My Saved Reddit Posts (${data.length})</h1>
  ${data.length === 0 ? `<p class="no-posts">No liked posts to display.</p>` : ''}
  ${data.map((post: any) => `
    <div class="post">
      <div class="post-title">${post.title}</div>
      <span class="subreddit">r/${post.subreddit}</span>
      ${post.aiSummary ? `<div class="summary"><strong>AI Summary:</strong> ${post.aiSummary}</div>` : ''}
      <div class="content">${post.selftext}</div>
      ${post.url ? `<p><a href="${post.url}" target="_blank" class="post-link">View on Reddit</a></p>` : ''}
    </div>
  `).join('')}
</body>
</html>`;
  
  const blob = new Blob([htmlContent], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}