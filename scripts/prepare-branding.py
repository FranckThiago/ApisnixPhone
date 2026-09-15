#!/usr/bin/env python3
"""Package the supplied, unchanged APISNIX mark as native application resources.

Run on macOS (sips) when updating branding; CI uses the exported patches.
"""
import base64
from pathlib import Path
import shutil
import struct
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
MARK = ROOT / 'branding/apisnix-mark.png'
ANDROID = ROOT / 'apps/android/app/src/main/res'
DESKTOP = ROOT / 'apps/desktop'


def png(size, destination):
    destination.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['sips', '-z', str(size), str(size), str(MARK), '--out', str(destination)],
                   check=True, stdout=subprocess.DEVNULL)


def main():
    if not shutil.which('sips'):
        raise SystemExit('The asset export requires macOS sips. Prepared assets are in the patches.')
    (ANDROID / 'drawable-nodpi').mkdir(exist_ok=True)
    shutil.copyfile(MARK, ANDROID / 'drawable-nodpi/apisnix_mark.png')
    for density, size in [('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)]:
        for name in ['ic_launcher.png', 'ic_launcher_round.png', 'linphone_launcher_icon_foreground.png']:
            png(size, ANDROID / f'mipmap-{density}' / name)
    for name, size in [('assistant_logo', 256), ('welcome_linphone_logo', 256), ('linphone_splashscreen', 192)]:
        (ANDROID / f'drawable/{name}.xml').write_text(f'''<?xml version="1.0" encoding="utf-8"?>
<!-- APISNIX supplied mark; original pixels preserved in drawable-nodpi. -->
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:width="{size}dp" android:height="{size}dp" android:gravity="center">
        <bitmap android:src="@drawable/apisnix_mark" android:gravity="fill" />
    </item>
</layer-list>
''')
    (ANDROID / 'drawable/linphone_notification.xml').write_text('''<?xml version="1.0" encoding="utf-8"?>
<bitmap xmlns:android="http://schemas.android.com/apk/res/android"
    android:src="@drawable/apisnix_mark" android:gravity="fill" />
''')
    for name in ['ic_launcher', 'ic_launcher_round']:
        (ANDROID / f'mipmap-anydpi/{name}.xml').write_text('''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@android:color/white" />
    <foreground>
        <inset android:drawable="@drawable/apisnix_mark" android:inset="18%" />
    </foreground>
    <monochrome>
        <inset android:drawable="@drawable/apisnix_mark" android:inset="18%" />
    </monochrome>
</adaptive-icon>
''')
    # Embed the original PNG in the existing SVG resource slots, without tracing or redesign.
    encoded = base64.b64encode(MARK.read_bytes()).decode()
    for name in ['logo.svg', 'logo_margins.svg', 'linphone.svg', 'splashscreen-logo.svg', 'login_image.svg']:
        (DESKTOP / 'Linphone/data/image' / name).write_text(f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="512" height="512" viewBox="0 0 512 512">
  <image width="512" height="512" xlink:href="data:image/png;base64,{encoded}" />
</svg>
''')
    for destination in (DESKTOP / 'Linphone/data/icon/hicolor').glob('*/apps/icon.png'):
        png(int(destination.parents[1].name.split('x')[0]), destination)
    # Windows ICO container: multi-resolution PNG entries, supported by modern Windows.
    with tempfile.TemporaryDirectory() as tmp:
        entries = []
        sizes = [16, 24, 32, 48, 64, 128, 256]
        for size in sizes:
            path = Path(tmp) / f'{size}.png'
            png(size, path)
            entries.append(path.read_bytes())
        offset = 6 + 16 * len(entries)
        headers = []
        for size, data in zip(sizes, entries):
            headers.append(struct.pack('<BBBBHHII', size % 256, size % 256, 0, 0, 1, 32, len(data), offset))
            offset += len(data)
        (DESKTOP / 'Linphone/data/icon.ico').write_bytes(
            struct.pack('<HHH', 0, 1, len(entries)) + b''.join(headers) + b''.join(entries))
    print('APISNIX Android and Desktop branding exported. Original logo files were not modified.')


if __name__ == '__main__':
    main()
