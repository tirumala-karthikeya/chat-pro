import uvicorn

if __name__ == "__main__":
    # For secure WebSockets with SSL
    #ssl_context = ('path/to/fullchain.pem', 'path/to/privkey.pem')
    uvicorn.run("main:app", host="0.0.0.0", port=8001)#, reload=True, ssl_context=ssl_context) 