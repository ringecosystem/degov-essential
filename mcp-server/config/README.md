# Configuration Guide: NODE_CONFIG_DIR

The `NODE_CONFIG_DIR` environment variable allows you to specify a custom configuration directory for the application. By default, the application uses the built-in configuration directory. However, if you need to override this with a different path, you can set the `NODE_CONFIG_DIR` variable.

## How to Use

1. **Default Behavior**:
   If `NODE_CONFIG_DIR` is not set, the application will use the default configuration directory located in the project.

2. **Custom Path**:
   To use a custom configuration directory, set the `NODE_CONFIG_DIR` environment variable to the desired path. For example:

   ```bash
   export NODE_CONFIG_DIR=/path/to/your/config
   ```

3. Verification:
   After setting the variable, you can verify its value by running:

```bash
echo $NODE_CONFIG_DIR
```

4. Restart the Application:
   Ensure you restart the application after setting or modifying the NODE_CONFIG_DIR variable so that the changes take effect.
