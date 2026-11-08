using UnityEngine;

[RequireComponent(typeof(CharacterController))]
public class ThirdPersonPlayer : MonoBehaviour
{
    public VirtualJoystick joystick;
    public Transform cameraTransform;
    public float moveSpeed = 5f;
    public float turnSpeed = 12f;
    private CharacterController controller;
    private float verticalSpeed;

    void Awake() { controller = GetComponent<CharacterController>(); }

    void Update()
    {
        Vector2 input = joystick ? joystick.Value : Vector2.zero;
#if UNITY_EDITOR || UNITY_STANDALONE
        input += new Vector2(Input.GetAxisRaw("Horizontal"), Input.GetAxisRaw("Vertical"));
#endif
        input = Vector2.ClampMagnitude(input, 1f);
        Vector3 forward = cameraTransform ? cameraTransform.forward : Vector3.forward;
        Vector3 right = cameraTransform ? cameraTransform.right : Vector3.right;
        forward.y = 0; right.y = 0; forward.Normalize(); right.Normalize();
        Vector3 direction = forward * input.y + right * input.x;

        if (direction.sqrMagnitude > .01f)
            transform.rotation = Quaternion.Slerp(transform.rotation,
                Quaternion.LookRotation(direction), turnSpeed * Time.deltaTime);

        if (controller.isGrounded && verticalSpeed < 0) verticalSpeed = -2f;
        verticalSpeed += -20f * Time.deltaTime;
        controller.Move((direction * moveSpeed + Vector3.up * verticalSpeed) * Time.deltaTime);
    }
}