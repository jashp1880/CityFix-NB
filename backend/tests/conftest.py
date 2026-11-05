import os
import tempfile
from pathlib import Path

os.environ['ENVIRONMENT'] = 'test'
os.environ['JWT_SECRET'] = 'test-only-secret-with-at-least-thirty-two-characters'
os.environ['DATABASE_URL'] = os.environ.get('TEST_DATABASE_URL') or 'sqlite:///' + str(Path(tempfile.gettempdir()) / 'cityfix-tests.db').replace('\\','/')
os.environ['FRONTEND_ORIGINS'] = 'http://localhost:5173'

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import engine
from app.models import Base


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    Path('uploads').mkdir()
    Base.metadata.drop_all(engine)
    with TestClient(app, headers={'Origin':'http://localhost:5173','X-CityFix':'1'}) as client:
        yield client


@pytest.fixture
def account(client):
    result = client.post('/auth/register',json={'email':'resident@example.com','name':'Test Resident','password':'a-strong-password-123'})
    assert result.status_code == 201
    return result.json()
