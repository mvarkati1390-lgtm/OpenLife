using UnityEngine;

public class OpenLifeCityGenerator : MonoBehaviour
{
    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    static void Install()
    {
        if (!FindObjectOfType<OpenLifeCityGenerator>())
            new GameObject("OpenLife City").AddComponent<OpenLifeCityGenerator>();
    }

    void Start() { BuildCity(); }

    void BuildCity()
    {
        Material road = Mat(new Color(.16f,.17f,.19f));
        Material sidewalk = Mat(new Color(.48f,.49f,.48f));
        Material grass = Mat(new Color(.22f,.38f,.22f));
        Material[] walls = {
            Mat(new Color(.68f,.62f,.52f)), Mat(new Color(.48f,.57f,.64f)),
            Mat(new Color(.72f,.72f,.68f)), Mat(new Color(.57f,.48f,.42f))
        };
        Material glass = Mat(new Color(.16f,.32f,.42f));
        Material treeMat = Mat(new Color(.12f,.31f,.16f));

        Cube("City Ground", new Vector3(0,-.18f,0), new Vector3(180,.3f,180), grass);
        Cube("Main Road", new Vector3(0,-.01f,0), new Vector3(12,.12f,180), road);
        Cube("Cross Road", new Vector3(0,.0f,0), new Vector3(180,.12f,12), road);
        Cube("Sidewalk West", new Vector3(-7,.08f,0), new Vector3(2,.25f,180), sidewalk);
        Cube("Sidewalk East", new Vector3(7,.08f,0), new Vector3(2,.25f,180), sidewalk);
        Cube("Sidewalk North", new Vector3(0,.08f,7), new Vector3(180,.25f,2), sidewalk);
        Cube("Sidewalk South", new Vector3(0,.08f,-7), new Vector3(180,.25f,2), sidewalk);

        for (int z=-72; z<=72; z+=18)
        {
            for (int side=-1; side<=1; side+=2)
            {
                if (Mathf.Abs(z)<12) continue;
                float x = side * Random.Range(17f,27f);
                float w = Random.Range(9f,14f);
                float d = Random.Range(9f,14f);
                float h = Random.Range(8f,24f);
                Material wall = walls[Random.Range(0,walls.Length)];
                Cube("Building", new Vector3(x,h/2f,z), new Vector3(w,h,d), wall);
                for (float y=2.5f; y<h-1f; y+=3f)
                {
                    for (float wx=-w/2f+1.5f; wx<w/2f-1f; wx+=3f)
                    {
                        Cube("Window", new Vector3(x+wx,y,z-d/2f-.07f),
                            new Vector3(1.35f,1.35f,.12f), glass);
                        Cube("Window", new Vector3(x+wx,y,z+d/2f+.07f),
                            new Vector3(1.35f,1.35f,.12f), glass);
                    }
                }
            }
        }

        for (int z=-70; z<=70; z+=14)
        {
            if (Mathf.Abs(z)<14) continue;
            for (int side=-1; side<=1; side+=2)
                MakeTree(new Vector3(side*10f,.1f,z), treeMat);
        }
        AddStreetLights();
    }

    void AddStreetLights()
    {
        Material pole = Mat(new Color(.12f,.13f,.15f));
        Material lamp = Mat(new Color(1f,.88f,.58f));
        for (int z=-70; z<=70; z+=28)
        {
            foreach (int side in new int[]{-1,1})
            {
                Vector3 p = new Vector3(side*8.5f,0,z);
                Cube("Street Light Pole", p+Vector3.up*3f, new Vector3(.18f,6f,.18f), pole);
                Cube("Street Light Head", p+new Vector3(0,6f,.8f), new Vector3(.8f,.18f,1.8f), lamp);
            }
        }
    }

    void MakeTree(Vector3 p, Material leaves)
    {
        Material trunk = Mat(new Color(.28f,.17f,.09f));
        var t = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
        t.name = "Tree Trunk"; t.transform.position=p+Vector3.up*1.2f;
        t.transform.localScale=new Vector3(.35f,1.2f,.35f); t.GetComponent<Renderer>().material=trunk;
        var crown = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        crown.name="Tree Crown"; crown.transform.position=p+Vector3.up*3f;
        crown.transform.localScale=new Vector3(2.4f,2.8f,2.4f); crown.GetComponent<Renderer>().material=leaves;
    }

    void Cube(string n, Vector3 p, Vector3 s, Material m)
    {
        var go=GameObject.CreatePrimitive(PrimitiveType.Cube);
        go.name=n; go.transform.position=p; go.transform.localScale=s;
        go.GetComponent<Renderer>().material=m;
    }

    Material Mat(Color c)
    {
        var m=new Material(Shader.Find("Standard"));
        m.color=c; return m;
    }
}