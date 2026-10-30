from executionos.factory import create_app

app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, ssl_context=("localhost+1.pem", "localhost+1-key.pem"))
