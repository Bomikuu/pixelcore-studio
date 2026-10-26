import io, json, zipfile
from django.http import HttpResponse
from django.views.decorators.http import require_http_methods
from .views import api, admin

MANIFEST = {'schemaVersion': 1, 'name': 'Orbit banner', 'description': 'A browser-ready Three.js background. Keep headings and buttons as native builder elements.', 'kind': 'background', 'usage': 'landing', 'entry': 'index.html', 'height': 420, 'author': 'Pixelcore Studio starter', 'license': '', 'sourceUrl': '', 'fallbackText': 'An animated orbit background', 'tags': ['threejs', 'banner'], 'networkOrigins': ['https://cdn.jsdelivr.net'], 'imports': {'three': 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js'}, 'fields': [{'key': 'color', 'label': 'Orbit color', 'type': 'color', 'default': '#3d5afe'}, {'key': 'speed', 'label': 'Rotation speed', 'type': 'number', 'min': 0, 'max': 3, 'default': 1}], 'dataKeys': []}
HTML = '''<!doctype html><html lang="en"><head><title>Orbit banner</title><style>html,body{margin:0;height:100%;overflow:hidden;background:var(--brand-background,#07172e)}canvas{display:block;width:100%;height:100%}</style></head><body><script type="module" src="./scene.js"></script></body></html>'''
JS = '''import * as THREE from 'three';
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(45,innerWidth/innerHeight,.1,100);
camera.position.z=5;const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));document.body.append(renderer.domElement);
const geometry=new THREE.TorusKnotGeometry(1,.27,96,12),material=new THREE.MeshBasicMaterial({color:'#3d5afe',wireframe:true});
const mesh=new THREE.Mesh(geometry,material);scene.add(mesh);let state={settings:{speed:1},visible:true,motion:true};
const resize=()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.render(scene,camera)};
addEventListener('resize',resize);resize();
ComponentLab.onUpdate(value=>{state=value;material.color.set(value.settings.color||'#3d5afe');renderer.render(scene,camera)});
let last=performance.now();function frame(now){requestAnimationFrame(frame);const elapsed=Math.min(.05,(now-last)/1000);last=now;if(!state.visible||!state.motion)return;mesh.rotation.x+=elapsed*.12*(state.settings.speed??1);mesh.rotation.y+=elapsed*.3*(state.settings.speed??1);renderer.render(scene,camera)}requestAnimationFrame(frame);
addEventListener('pagehide',()=>{geometry.dispose();material.dispose();renderer.dispose()},{once:true});
'''
@api
@require_http_methods(['GET'])
def starter(request):
    admin(request)
    output=io.BytesIO()
    with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as z:
        z.writestr('component.json', json.dumps(MANIFEST,indent=2)); z.writestr('index.html',HTML); z.writestr('scene.js',JS)
    response=HttpResponse(output.getvalue(), content_type='application/zip');response['Content-Disposition']='attachment; filename="pixelcore-orbit-starter.zip"'
    return response
