import io
import json
from PIL import Image
from sqlalchemy import select
from app.database import SessionLocal
from app.models import User, Report
from app.config import settings


def photo():
    out = io.BytesIO()
    image = Image.new('RGB',(80,80),'#657345')
    image.save(out,'JPEG',exif=b'Exif\x00\x00')
    return out.getvalue()


def report(client, **changes):
    values = dict(title='Broken sidewalk',description='An uneven section of sidewalk needs repair.',category='sidewalk',
        severity='medium',jurisdiction='rutgers',location='College Avenue',latitude='40.5',longitude='-74.447',confirmed='true')
    values.update(changes)
    return client.post('/reports',data=values,files={'image':('photo.jpg',photo(),'image/jpeg')})


def test_auth_profile_logout_revokes_token(client, account):
    cookie = client.cookies.get('cityfix_session')
    assert client.get('/auth/me').json()['email'] == account['email']
    assert client.patch('/auth/me',json={'name':'New Name'}).json()['name'] == 'New Name'
    with SessionLocal() as db:
        user = db.get(User,account['id'])
        assert user.password_hash.startswith('$argon2id$')
        assert 'a-strong-password' not in user.password_hash
        assert not user.is_admin
    assert client.post('/auth/logout').status_code == 204
    assert client.get('/auth/me').status_code == 401
    client.cookies.set('cityfix_session',cookie)
    assert client.get('/auth/me').status_code == 401
    client.cookies.clear()
    assert client.post('/auth/login',json={'email':account['email'],'password':'wrong'}).status_code == 401
    assert client.post('/auth/login',json={'email':account['email'],'password':'a-strong-password-123'}).status_code == 200


def test_report_history_duplicate_admin_and_public_privacy(client, account):
    created = report(client)
    assert created.status_code == 201, created.text
    data = created.json()
    assert data['history'][0]['status'] == 'submitted'
    assert data['routing']['department'] == 'Rutgers University Facilities'
    assert data['route_approved'] is False
    assert 'email' not in json.dumps(data) and 'user_id' not in data
    assert len(client.get('/reports/mine').json()) == 1
    assert client.get('/reports?category=road').json()['total'] == 0
    assert client.get('/reports?category=sidewalk').json()['total'] == 1
    duplicate = report(client)
    assert duplicate.status_code == 409
    assert duplicate.json()['detail']['duplicates'][0]['reason'] == 'Same photo'
    assert report(client,duplicate_acknowledged='true').json()['duplicate_of'] == data['id']
    assert client.patch('/admin/reports/1',json={'status':'resolved','note':'Fixed the sidewalk.'}).status_code == 403
    with SessionLocal() as db:
        db.get(User,account['id']).is_admin = True
        db.commit()
    result = client.patch('/admin/reports/1',json={'status':'resolved','note':'Fixed the sidewalk.','route_approved':True})
    assert result.status_code == 200
    assert len(result.json()['history']) == 2
    assert result.json()['history'][-1]['note'] == 'Fixed the sidewalk.'
    assert result.json()['route_approved'] is True
    assert client.get('/reports?status=resolved').json()['total'] == 1
    assert client.get('/reports/999').status_code == 404


def test_validation_and_csrf(client, account):
    assert report(client,confirmed='false').status_code == 422
    assert report(client,latitude='0').status_code == 422
    assert report(client,category='invalid').status_code == 422
    assert report(client,title='   ').status_code == 422
    assert client.post('/auth/login',json={},headers={'Origin':'https://evil.example'}).status_code == 403
    assert client.post('/auth/register',json={'name':'X','email':'bad','password':'short'}).status_code == 422
    assert client.post('/auth/register',json={'name':'Another','email':account['email'],'password':'another-strong-password'}).status_code == 409
    assert client.post('/reports',data={},files={'image':('fake.jpg',b'not an image','image/jpeg')}).status_code == 422


def test_upload_content_and_size(client, account):
    values=dict(title='Broken sidewalk',description='Needs attention here.',category='sidewalk',severity='low',jurisdiction='rutgers',location='College Ave',latitude='40.5',longitude='-74.447',confirmed='true')
    assert client.post('/reports',data=values,files={'image':('a.jpg',b'not-an-image','image/jpeg')}).status_code == 422
    assert client.post('/reports',data=values,files={'image':('big.jpg',b'x'*(5*1024*1024+1),'image/jpeg')}).status_code == 413
    result = report(client)
    assert result.status_code == 201
    with SessionLocal() as db:
        key = db.get(Report,1).image_key
    with Image.open('uploads/'+key) as saved:
        assert not saved.getexif()


def test_ai_requires_consent_and_configuration(client, account, monkeypatch):
    monkeypatch.setattr(settings(),'gemini_api_key','')
    assert client.post('/ai/suggest',data={'consent':'false'},files={'image':('a.jpg',photo(),'image/jpeg')}).status_code == 422
    assert client.post('/ai/suggest',data={'consent':'true'},files={'image':('a.jpg',photo(),'image/jpeg')}).status_code == 503


def test_ai_suggestion_parsed_not_submitted(client, account, monkeypatch):
    import httpx
    monkeypatch.setattr(settings(),'gemini_api_key','test-only-provider-key')
    class Provider:
        async def __aenter__(self): return self
        async def __aexit__(self,*args): pass
        async def post(self,url,**kwargs):
            assert kwargs['json']['contents'][0]['parts'][1]['inline_data']['mime_type'] == 'image/jpeg'
            return httpx.Response(200,request=httpx.Request('POST',url),json={'candidates':[{'content':{'parts':[{'text':json.dumps({'category':'road','severity':'medium','title':'Possible pothole','description':'A road surface defect is visible.'})}]}}]})
    monkeypatch.setattr('app.main.httpx.AsyncClient',lambda **kwargs:Provider())
    result=client.post('/ai/suggest',data={'consent':'true'},files={'image':('a.jpg',photo(),'image/jpeg')})
    assert result.status_code == 200, result.text
    assert result.json()['requires_confirmation'] is True
    assert client.get('/reports').json()['total'] == 0


def test_pagination_cors_auth_and_rate_limit(client):
    assert client.get('/reports/mine').status_code == 401
    assert client.get('/reports?page_size=500').status_code == 422
    response=client.options('/reports',headers={'Origin':'http://localhost:5173','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'X-CityFix'})
    assert response.headers['access-control-allow-origin'] == 'http://localhost:5173'
    assert client.get('/health').json()['status']=='ok'
    for _ in range(12):
        assert client.post('/auth/login',json={'email':'nobody@example.com','password':'wrong'}).status_code == 401
    assert client.post('/auth/login',json={'email':'nobody@example.com','password':'wrong'}).status_code == 429
