#!/usr/bin/env python3
"""Render and exercise the compact QML pages with Qt, without a SIP connection.

Requires PySide6. This checks the real UI components in a small temporary QML
module; integration with the native Linphone engine still needs Windows testing.
"""
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
os.environ.setdefault("QT_QUICK_BACKEND", "software")
from PySide6.QtCore import QMetaObject, QPoint, Qt, QUrl
from PySide6.QtGui import QGuiApplication
from PySide6.QtQuick import QQuickItem, QQuickView
from PySide6.QtTest import QSignalSpy, QTest

ROOT = Path(__file__).resolve().parent.parent
VIEW = ROOT / "apps/desktop/Linphone/view"
OUTPUT = ROOT / ".work/compact-ui-qa"


def signal_spy(obj, signature):
    meta = obj.metaObject()
    index = meta.indexOfSignal(signature)
    assert index >= 0, signature
    return QSignalSpy(obj, meta.method(index))


def find_item(root, name):
    if root.objectName() == name:
        return root
    for child in root.childItems():
        found = find_item(child, name)
        if found is not None:
            return found
    return None


def click(view, item):
    assert item and item.property("enabled"), "Control unavailable"
    point = item.mapToScene(item.boundingRect().center())
    assert 0 <= point.x() < view.width() and 0 <= point.y() < view.height(), "Control outside window"
    QTest.mouseClick(view, Qt.LeftButton, Qt.NoModifier, QPoint(int(point.x()), int(point.y())))
    QTest.qWait(30)


def main():
    app = QGuiApplication(sys.argv)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as temporary:
        imports = Path(temporary)
        module = imports / "Linphone"
        module.mkdir()
        components = {
            "CompactButton": "Control/Button/CompactButton.qml",
            "CompactDialPad": "Control/Input/CompactDialPad.qml",
            "CompactPhonePage": "Page/Main/Call/CompactPhonePage.qml",
            "CompactCallPage": "Page/Main/Call/CompactCallPage.qml",
        }
        for name, source in components.items():
            shutil.copyfile(VIEW / source, module / (name + ".qml"))
        (module / "qmldir").write_text("module Linphone\n" + "\n".join(
            name + " 1.0 " + name + ".qml" for name in components))

        def create(component, properties):
            source = imports / (component + "Test.qml")
            source.write_text("import QtQuick\nimport Linphone 1.0\n" + component
                              + " { width: 420; height: 680; " + properties + " }\n")
            window = QQuickView()
            window.engine().addImportPath(str(imports))
            window.setResizeMode(QQuickView.SizeRootObjectToView)
            window.setSource(QUrl.fromLocalFile(str(source)))
            assert window.status() != QQuickView.Error, [e.toString() for e in window.errors()]
            window.resize(420, 680)
            window.show()
            QTest.qWait(120)
            return window, window.rootObject()

        logo = QUrl.fromLocalFile(str(ROOT / "branding/apisnix-mark.png")).toString()
        window, phone = create("CompactPhonePage", "brandLogo: " + json.dumps(logo)
                               + '; accountLabel: "poste-test@apisnix-crm.com"; statusText: "Connexion en cours…"')
        number = find_item(phone, "phoneNumber")
        dial = find_item(phone, "dialButton")
        spy = signal_spy(phone, "dialRequested(QString)")
        number.setProperty("text", "0123456789")
        QMetaObject.invokeMethod(phone, "dial")
        assert spy.count() == 0 and not dial.property("enabled"), "Offline dialing must be blocked"
        phone.setProperty("registered", True)
        QTest.qWait(50)
        window.grabWindow().save(str(OUTPUT / "phone-initial.png"))
        click(window, dial)
        assert spy.count() == 1 and spy.at(0)[0] == "0123456789"
        QMetaObject.invokeMethod(phone, "dial")
        assert spy.count() == 1, "Prevent duplicate clicks while starting a call"
        phone.setProperty("dialPending", False)
        number.setProperty("text", "")
        number.setProperty("cursorPosition", 0)
        click(window, find_item(phone, "digit_1"))
        click(window, find_item(phone, "digit_2"))
        assert number.property("text") == "12", "Keypad must insert at cursor"
        click(window, find_item(phone, "eraseNumber"))
        assert number.property("text") == "1"
        number.setProperty("text", "0123456789")
        window.grabWindow().save(str(OUTPUT / "phone.png"))
        phone.setProperty("hasCall", True)
        reopen = signal_spy(phone, "openCallRequested()")
        click(window, dial)
        assert reopen.count() == 1 and spy.count() == 1, "Active call button must reopen, not redial"
        window.close()

        call_window, call = create("CompactCallPage", 'remoteName: "Appel de test"; statusText: "En communication"; durationText: "02:17"; connected: true; canPause: true; showKeypad: true')
        dtmf = signal_spy(call, "dtmfRequested(QString)")
        click(call_window, find_item(call, "digit_5"))
        assert dtmf.count() == 1 and dtmf.at(0)[0] == "5"
        call.setProperty("terminated", True)
        assert not find_item(call, "digit_5").property("enabled")
        call.setProperty("terminated", False)
        call_window.grabWindow().save(str(OUTPUT / "call.png"))
        call_window.close()
        print("Compact UI: creation, offline gate, dial, duplicate-click guard, keypad, erase, active call and DTMF passed.")
        print("Preview images:", OUTPUT)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
