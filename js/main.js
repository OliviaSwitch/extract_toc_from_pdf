// 设置PDF.js工作路径
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', function() {
  // 获取DOM元素
  const fileInput = document.getElementById('fileInput');
  const fileName = document.getElementById('fileName');
  const tocResult = document.getElementById('tocResult');
  const loadingIndicator = document.getElementById('loadingIndicator');
  const exportButtons = document.getElementById('exportButtons');
  const copyBtn = document.getElementById('copyBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const downloadMarkdownBtn = document.getElementById('downloadMarkdownBtn');
  const formatRadios = document.querySelectorAll('input[name="format"]');
  const dropArea = document.getElementById('dropArea');
  const emptyState = document.getElementById('emptyState');

  // 存储提取的目录数据
  let extractedOutline = null;
  // 存储当前选择的PDF文件名（不带扩展名）
  let currentPdfName = '';

  // 设置拖放功能
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  ['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, highlight, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, unhighlight, false);
  });

  function highlight() {
    dropArea.classList.add('highlight');
  }

  function unhighlight() {
    dropArea.classList.remove('highlight');
  }

  // 处理拖放文件
  dropArea.addEventListener('drop', handleDrop, false);

  function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files.length > 0 && files[0].type === 'application/pdf') {
      fileInput.files = files;
      handleFileSelectEvent({target: fileInput});
    }
  }

  // 监听文件选择事件
  fileInput.addEventListener('change', handleFileSelectEvent);

  // 监听格式选择变化
  formatRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (extractedOutline) {
        displayOutline(extractedOutline);
      }
    });
  });

  // 处理文件选择事件
  async function handleFileSelectEvent(event) {
    const file = event.target.files[0];
    if (!file || file.type !== 'application/pdf') {
      alert('请选择有效的PDF文件');
      return;
    }

    // 获取文件名（不含扩展名）
    currentPdfName = file.name.replace(/\.pdf$/i, '');
    fileName.textContent = file.name;
    tocResult.innerHTML = '';
    tocResult.style.display = 'none';
    exportButtons.style.display = 'none';
    loadingIndicator.style.display = 'flex';

    try {
      // 读取文件
      const arrayBuffer = await readFileAsArrayBuffer(file);
      
      // 加载PDF文档
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      // 提取目录
      extractedOutline = await extractOutline(pdf);
      
      // 显示目录
      displayOutline(extractedOutline);
      
      tocResult.style.display = 'block';
      exportButtons.style.display = 'flex';
    } catch (error) {
      console.error('处理PDF文件时出错:', error);
      tocResult.innerHTML = `<p class="error">处理PDF文件时出错: ${error.message}</p>`;
      tocResult.style.display = 'block';
    } finally {
      loadingIndicator.style.display = 'none';
    }
  }

  // 将文件读取为ArrayBuffer
  function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  // 提取PDF目录
  async function extractOutline(pdf) {
    const outline = await pdf.getOutline();
    if (!outline || outline.length === 0) {
      showEmptyState('未能从PDF中提取到目录，可能该PDF未包含目录结构');
      throw new Error('未在PDF中找到目录。');
    }
    return outline;
  }

  // 获取当前选择的格式
  function getSelectedFormat() {
    return document.querySelector('input[name="format"]:checked').value;
  }

  // 显示目录内容
  function displayOutline(outline) {
    if (!outline || outline.length === 0) {
      tocResult.textContent = '未找到目录。';
      return;
    }
    
    const format = getSelectedFormat();
    
    if (format === 'markdown') {
      tocResult.textContent = generateMarkdownTOC(outline);
    } else {
      tocResult.textContent = generatePlainTextTOC(outline);
    }
  }

  // 生成纯文本格式的目录
  function generatePlainTextTOC(outline) {
    let tocText = '';
    
    function processItems(items, indent = 0) {
      for (const item of items) {
        // 创建缩进
        const indentation = '  '.repeat(indent);
        
        // 添加目录项
        tocText += `${indentation}${item.title}\n`;
        
        // 如果有子项，递归处理
        if (item.items && item.items.length > 0) {
          processItems(item.items, indent + 1);
        }
      }
    }
    
    processItems(outline);
    return tocText;
  }

  // 生成Markdown格式的目录
  function generateMarkdownTOC(outline) {
    let tocText = '';
    
    function processItems(items, indent = 0) {
      for (const item of items) {
        // 计算Markdown标题级别（最大为6级）
        const headingLevel = Math.min(indent + 1, 6);
        const heading = '#'.repeat(headingLevel);
        
        // 添加目录项
        tocText += `${heading} ${item.title}\n\n`;
        
        // 如果有子项，递归处理
        if (item.items && item.items.length > 0) {
          processItems(item.items, indent + 1);
        }
      }
    }
    
    processItems(outline);
    return tocText;
  }

  // 复制到剪贴板
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(tocResult.textContent)
      .then(() => {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = '已复制!';
        setTimeout(() => {
          copyBtn.textContent = originalText;
        }, 2000);
      })
      .catch(err => {
        console.error('无法复制到剪贴板:', err);
      });
  });

  // 下载为文本文件
  downloadBtn.addEventListener('click', () => {
    const text = tocResult.textContent;
    // 使用PDF文件名作为下载文件名
    const downloadName = currentPdfName ? `${currentPdfName}_目录.txt` : 'pdf目录.txt';
    downloadFile(text, downloadName, 'text/plain');
  });

  // 下载为Markdown文件
  downloadMarkdownBtn.addEventListener('click', () => {
    let text;
    const currentFormat = getSelectedFormat();
    
    // 如果当前不是Markdown格式，则转换为Markdown
    if (currentFormat !== 'markdown' && extractedOutline) {
      text = generateMarkdownTOC(extractedOutline);
    } else {
      text = tocResult.textContent;
    }
    
    // 使用PDF文件名作为下载文件名
    const downloadName = currentPdfName ? `${currentPdfName}_目录.md` : 'pdf目录.md';
    downloadFile(text, downloadName, 'text/markdown');
  });

  // 下载文件通用函数
  function downloadFile(content, fileName, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // 为按钮添加涟漪效果
  const buttons = document.querySelectorAll('.btn, .upload-button');
  buttons.forEach(button => {
    button.addEventListener('mousedown', createRipple);
  });

  function createRipple(event) {
    const button = event.currentTarget;
    
    // 创建涟漪元素
    const ripple = document.createElement('span');
    const rect = button.getBoundingClientRect();
    
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    // 设置涟漪样式
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    ripple.classList.add('ripple');
    
    // 添加涟漪效果
    button.appendChild(ripple);
    
    // 移除涟漪效果
    setTimeout(() => {
      ripple.remove();
    }, 600);
  }

  // 添加涟漪效果的CSS
  const style = document.createElement('style');
  style.textContent = `
    .btn, .upload-button {
      position: relative;
      overflow: hidden;
    }
    .ripple {
      position: absolute;
      background-color: rgba(255, 255, 255, 0.4);
      border-radius: 50%;
      transform: scale(0);
      animation: ripple 0.6s linear;
      pointer-events: none;
    }
    @keyframes ripple {
      to {
        transform: scale(4);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);

  // 显示空状态提示
  function showEmptyState(message) {
    if (!emptyState) {
      emptyState = document.createElement('div');
      emptyState.className = 'toc-empty-state';
      emptyState.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <path d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
        </svg>
        <p>${message}</p>
      `;
      tocResult.innerHTML = '';
      tocResult.appendChild(emptyState);
    } else {
      emptyState.querySelector('p').textContent = message;
      emptyState.style.display = 'flex';
    }
  }

  // 初始化时显示空状态
  showEmptyState('请上传PDF文件以提取目录内容');
});
