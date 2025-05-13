def create_html_files():
    for i in range(1, 21):
        filename = f's{i}.html'
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(f'''<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>페이지 {i}</title>
</head>
<body>
    <h1>페이지 {i}</h1>
    <p>이것은 {i}번째 페이지입니다.</p>
</body>
</html>''')
        print(f'{filename} 파일이 생성되었습니다.')

if __name__ == '__main__':
    create_html_files()
