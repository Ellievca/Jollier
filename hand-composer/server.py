import numpy as np
from fastapi import FastAPI
from pydantic import BaseModel
import torch, torch.nn as nn, torch.nn.functional as F

class SimpleMLP(nn.Module):
    def __init__(self, in_dim=63, hidden=64, out_dim=3):
        super().__init__()
        self.fc1 = nn.Linear(in_dim, hidden)
        self.fc2 = nn.Linear(hidden, hidden)
        self.fc3 = nn.Linear(hidden, out_dim)
    def forward(self, x):
        x = F.relu(self.fc1(x)); x = F.relu(self.fc2(x)); return self.fc3(x)

QUALITY = ["min", "maj", "7"]
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")  # ROCm shows as 'cuda'
model = SimpleMLP().to(device).eval()

class Landmarks(BaseModel):
    left21: list  # 21 items, each [x,y,z]

app = FastAPI()

@torch.inference_mode()
@app.post("/predict")
def predict(payload: Landmarks):
    arr = np.array(payload.left21, dtype="float32").reshape(-1)  # 63
    x = torch.from_numpy(arr).to(device).unsqueeze(0)
    logits = model(x)
    idx = int(torch.argmax(logits, dim=1))
    return {"quality": QUALITY[idx]}

