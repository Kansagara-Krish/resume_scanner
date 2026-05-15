# 🚀 On-Demand Ollama Setup

## How It Works Now

The Ollama service runs **only when needed** to save your laptop's resources and battery:

### Normal Workflow

1. **Start Backend** (always running)
   ```bash
   cd backend
   uvicorn app.main:app --port 8000 --host 0.0.0.0
   ```

2. **Use Dashboard** (no Ollama needed yet)
   - Browse job roles ✅
   - View skills ✅
   - Browse candidates ✅

3. **Upload Resume** → System detects Ollama not running
   - Logs message: "⚠️ Ollama is not running. To process resumes, please start Ollama with: ollama serve"
   - **Start Ollama in a new terminal:**
     ```bash
     ollama serve
     ```
   - **Retry upload** → Processing starts instantly

4. **Processing Complete** → Stop Ollama when done
   - Close the `ollama serve` terminal or press Ctrl+C
   - Laptop CPU/RAM freed up immediately ✅

## Why This Approach?

| Aspect | Always-On | On-Demand |
|--------|-----------|-----------|
| CPU Usage | 🔴 Continuous | 🟢 Only during upload |
| Memory | 🔴 ~5GB always | 🟢 ~5GB when needed |
| Battery | 🔴 High drain | 🟢 Low drain |
| Startup Speed | 🟡 Slower (preload) | 🟢 Fast |
| Upload Speed | 🟢 Instant | 🟡 First load ~10-15s |

## Performance Notes

- **First resume upload** after starting Ollama: ~10-15 seconds (model loads)
- **Subsequent uploads** in same session: ~5-10 seconds (model cached)
- Ollama auto-unloads after 5 minutes of idle (configurable)

## Troubleshooting

### "Ollama could not be reached"
→ Start Ollama: `ollama serve`

### Laptop too slow while Ollama running
→ Stop Ollama: Close terminal or Ctrl+C

### Model not responding
→ Restart Ollama service and retry upload

## Technical Details

- Backend: Always listening on http://localhost:8000
- Ollama: Listen on http://localhost:11434 (only when started)
- Model: llama3:latest (auto-loads on first request)
- Config: backend/app/core/config.py
