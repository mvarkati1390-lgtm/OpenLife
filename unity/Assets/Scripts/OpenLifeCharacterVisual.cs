using UnityEngine;

public class OpenLifeCharacterVisual : MonoBehaviour
{
    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    static void Install()
    {
        var player=GameObject.Find("Player");
        if (player && !player.GetComponent<OpenLifeCharacterVisual>())
            player.AddComponent<OpenLifeCharacterVisual>();
    }

    void Start()
    {
        var capsule=GetComponent<Renderer>();
        if(capsule) capsule.enabled=false;

        Material shirt=Make(new Color(.12f,.28f,.58f));
        Material pants=Make(new Color(.12f,.14f,.19f));
        Material skin=Make(new Color(.72f,.52f,.38f));
        Material shoes=Make(new Color(.08f,.08f,.09f));

        Part("Torso",PrimitiveType.Capsule,new Vector3(0,.05f,0),new Vector3(.72f,.85f,.42f),shirt);
        Part("Head",PrimitiveType.Sphere,new Vector3(0,1.02f,0),new Vector3(.42f,.48f,.42f),skin);
        Part("Left Leg",PrimitiveType.Capsule,new Vector3(-.19f,-.58f,0),new Vector3(.25f,.65f,.25f),pants);
        Part("Right Leg",PrimitiveType.Capsule,new Vector3(.19f,-.58f,0),new Vector3(.25f,.65f,.25f),pants);
        Part("Left Shoe",PrimitiveType.Cube,new Vector3(-.19f,-.94f,.08f),new Vector3(.29f,.16f,.42f),shoes);
        Part("Right Shoe",PrimitiveType.Cube,new Vector3(.19f,-.94f,.08f),new Vector3(.29f,.16f,.42f),shoes);
        Part("Left Arm",PrimitiveType.Capsule,new Vector3(-.48f,.08f,0),new Vector3(.22f,.68f,.22f),shirt);
        Part("Right Arm",PrimitiveType.Capsule,new Vector3(.48f,.08f,0),new Vector3(.22f,.68f,.22f),shirt);
    }

    void Part(string partName,PrimitiveType type,Vector3 localPosition,Vector3 scale,Material material)
    {
        var go=GameObject.CreatePrimitive(type);
        go.name=partName; go.transform.SetParent(transform,false);
        go.transform.localPosition=localPosition; go.transform.localScale=scale;
        var col=go.GetComponent<Collider>();
        if(col) Destroy(col);
        go.GetComponent<Renderer>().material=material;
    }

    Material Make(Color color)
    {
        var m=new Material(Shader.Find("Standard"));
        m.color=color; return m;
    }
}