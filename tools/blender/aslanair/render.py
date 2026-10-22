"""Review renders: Cycles, physical sky, volumetric cloud deck, named camera shots."""
import math
import os
import time

import bpy
from mathutils import Vector

from . import context as ctx
from .geometry import X
from .mesh import hex2lin, pbsdf, setin


def render(shots, samples, clouds):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for dt in ('OPTIX', 'CUDA'):
        try:
            prefs.compute_device_type = dt; prefs.get_devices()
            if any(d.type == dt for d in prefs.devices):
                for d in prefs.devices: d.use = (d.type == dt)
                ctx.log('device', dt, [d.name for d in prefs.devices if d.use]); break
        except Exception as e:
            ctx.log('device', dt, 'failed', e)
    scene.cycles.device = 'GPU'
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 1600, 900
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.exposure = float(os.environ.get('EXPOSURE', '-3.0'))
    try: scene.view_settings.look = 'AgX - Medium High Contrast'
    except Exception: pass

    world = bpy.data.worlds.new('Sky'); scene.world = world
    try: world.use_nodes = True
    except Exception: pass
    nt = world.node_tree; nt.nodes.clear()
    sky = nt.nodes.new('ShaderNodeTexSky'); bg = nt.nodes.new('ShaderNodeBackground'); wout = nt.nodes.new('ShaderNodeOutputWorld')
    nt.links.new(sky.outputs['Color'], bg.inputs['Color']); nt.links.new(bg.outputs['Background'], wout.inputs['Surface'])
    types = [i.identifier for i in sky.bl_rna.properties['sky_type'].enum_items]
    for t in ('MULTIPLE_SCATTERING', 'NISHITA', 'SINGLE_SCATTERING', 'HOSEK_WILKIE'):
        if t in types: sky.sky_type = t; break
    ctx.log('sky types', types, '->', sky.sky_type)
    for k, val in (('sun_disc', True), ('sun_size', math.radians(1.2)), ('altitude', 3500.0),
                   ('air_density', 1.0), ('dust_density', 0.5), ('aerosol_density', 0.5), ('ozone_density', 1.0)):
        if hasattr(sky, k):
            try: setattr(sky, k, val)
            except Exception as e: ctx.log('sky', k, e)

    if clouds:
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, -650))
        deck = bpy.context.active_object; deck.name = 'CloudDeck'; deck.scale = (12000, 12000, 420)
        cm = bpy.data.materials.new('Clouds')
        try: cm.use_nodes = True
        except Exception: pass
        cn = cm.node_tree; cn.nodes.clear(); N_ = cn.nodes.new; Lk = cn.links.new
        geo = N_('ShaderNodeNewGeometry'); tc = N_('ShaderNodeTexCoord'); sep = N_('ShaderNodeSeparateXYZ')
        mp = N_('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (0.0016, 0.0016, 0.0032)
        nz = N_('ShaderNodeTexNoise'); nz.inputs['Detail'].default_value = 6; nz.inputs['Roughness'].default_value = 0.55
        thr = N_('ShaderNodeMath'); thr.operation = 'MULTIPLY_ADD'; thr.inputs[1].default_value = 0.17; thr.inputs[2].default_value = 0.51
        sub = N_('ShaderNodeMath'); sub.operation = 'SUBTRACT'
        k = N_('ShaderNodeMath'); k.operation = 'MULTIPLY'; k.inputs[1].default_value = 9.0; k.use_clamp = True
        base = N_('ShaderNodeMapRange'); base.interpolation_type = 'SMOOTHSTEP'
        base.inputs['From Min'].default_value = 0.0; base.inputs['From Max'].default_value = 0.06
        m2 = N_('ShaderNodeMath'); m2.operation = 'MULTIPLY'
        dens = N_('ShaderNodeMath'); dens.operation = 'MULTIPLY'; dens.inputs[1].default_value = 0.06
        vol = N_('ShaderNodeVolumePrincipled'); setin(vol, 'Anisotropy', 0.35); setin(vol, 'Color', (1.0, 1.0, 1.0, 1.0))
        mo = N_('ShaderNodeOutputMaterial')
        Lk(geo.outputs['Position'], mp.inputs['Vector']); Lk(mp.outputs['Vector'], nz.inputs['Vector'])
        Lk(tc.outputs['Generated'], sep.inputs['Vector']); Lk(sep.outputs['Z'], thr.inputs[0])
        Lk(nz.outputs['Fac'], sub.inputs[0]); Lk(thr.outputs['Value'], sub.inputs[1]); Lk(sub.outputs['Value'], k.inputs[0])
        Lk(sep.outputs['Z'], base.inputs['Value'])
        Lk(k.outputs['Value'], m2.inputs[0]); Lk(base.outputs['Result'], m2.inputs[1])
        Lk(m2.outputs['Value'], dens.inputs[0]); Lk(dens.outputs['Value'], vol.inputs['Density'])
        Lk(vol.outputs['Volume'], mo.inputs['Volume'])
        deck.data.materials.append(cm)
        scene.cycles.volume_bounces = 6
        try: scene.cycles.volume_step_rate = 2.0
        except Exception: pass
        # ocean far below, fading into horizon haze with distance
        bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, -2600))
        sea = bpy.context.active_object; sea.name = 'Sea'; sea.scale = (80000, 80000, 1)
        om = bpy.data.materials.new('Sea')
        try: om.use_nodes = True
        except Exception: pass
        ob_ = pbsdf(om); on = om.node_tree.nodes; ol = om.node_tree.links.new
        cam_d = on.new('ShaderNodeCameraData'); mr = on.new('ShaderNodeMapRange'); mr.interpolation_type = 'SMOOTHSTEP'
        mr.inputs['From Min'].default_value = 3000; mr.inputs['From Max'].default_value = 40000
        mix = on.new('ShaderNodeMix'); mix.data_type = 'RGBA'
        mix.inputs['A'].default_value = (*hex2lin('#1d4566'), 1); mix.inputs['B'].default_value = (*hex2lin('#b9d0e6'), 1)
        ol(cam_d.outputs['View Distance'], mr.inputs['Value']); ol(mr.outputs['Result'], mix.inputs['Factor'])
        ol(mix.outputs['Result'], ob_.inputs['Base Color']); setin(ob_, 'Roughness', 0.35)
        sea.data.materials.append(om)

    cam_data = bpy.data.cameras.new('Cam'); cam = bpy.data.objects.new('Cam', cam_data)
    scene.collection.objects.link(cam); scene.camera = cam
    cam_data.clip_start, cam_data.clip_end = 0.05, 20000

    def look(pos, target, lens):
        cam.location = pos; cam_data.lens = lens
        cam.rotation_euler = (Vector(target) - Vector(pos)).to_track_quat('-Z', 'Y').to_euler()

    def sun(elev, dx, dy):  # (dx, dy): horizontal direction towards the sun
        if hasattr(sky, 'sun_elevation'): sky.sun_elevation = math.radians(elev)
        if hasattr(sky, 'sun_rotation'): sky.sun_rotation = math.atan2(-dx, dy) % (2 * math.pi)

    SHOT_DEF = {
        'hero':   dict(pos=(46, 40, 9), target=(0, 0, -0.5), lens=70, sun=(38, 0.45, 0.89)),
        'side':   dict(pos=(2, -80, 2.5), target=(0, 0, 0.6), lens=85, sun=(42, 0.35, -0.94)),
        'window': dict(pos=(X(18.8), -2.16, 0.62), target=(X(15.5), -12.0, -0.8), lens=22, sun=(40, 0.6, -0.8)),
        'nose':   dict(pos=(14.5, -9.5, 1.8), target=(X(3.2), 0, 0.3), lens=50, sun=(35, 0.7, -0.7)),
        'engine': dict(pos=(X(9.0), -10.5, -2.6), target=(X(14.0), -5.75, -2.3), lens=45, sun=(35, 0.8, -0.6)),
    }
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ctx.OUT, 'airliner.blend'))
    for name in shots:
        d = SHOT_DEF[name]
        look(d['pos'], d['target'], d['lens']); sun(*d['sun'])
        if clouds:
            for o in ('CloudDeck', 'Sea'): bpy.data.objects[o].hide_render = (name in ('nose', 'engine'))
        scene.render.filepath = os.path.join(ctx.OUT, 'renders', name + '.png')
        t = time.time(); bpy.ops.render.render(write_still=True)
        ctx.log('rendered', name, f'{time.time() - t:.1f}s')
    ctx.log('done')
