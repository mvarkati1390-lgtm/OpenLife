#if UNITY_EDITOR
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
using System.IO;

public static class OpenLifeProjectSetup
{
    [MenuItem("OpenLife/Setup Prototype Scene")]
    public static void Setup()
    {
        const string sceneFolder = "Assets/Scenes";
        if (!Directory.Exists(sceneFolder)) Directory.CreateDirectory(sceneFolder);

        var scene = EditorSceneManager.NewScene(NewSceneSetup.DefaultGameObjects, NewSceneMode.Single);
        scene.name = "OpenLife";
        var path = sceneFolder + "/OpenLife.unity";
        EditorSceneManager.SaveScene(scene, path);

        EditorBuildSettings.scenes = new[]
        {
            new EditorBuildSettingsScene(path, true)
        };

        PlayerSettings.productName = "OpenLife";
        PlayerSettings.companyName = "OpenLife Studio";
        PlayerSettings.applicationIdentifier = "com.openlife.game";
        PlayerSettings.defaultInterfaceOrientation = UIOrientation.LandscapeLeft;
        PlayerSettings.runInBackground = true;

        AssetDatabase.Refresh();
        Debug.Log("OpenLife setup complete. Press Play to launch the generated prototype.");
    }
}
#endif
