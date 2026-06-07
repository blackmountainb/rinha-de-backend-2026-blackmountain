IMAGE_NAME=blackmountain-rinha
TAG=latest

build:
	docker build -t $(IMAGE_NAME):$(TAG)

run:
	docker run -p 9999:9999 $(IMAGE_NAME):$(TAG)

up:
	docker compose up --build

down:
	docker compose down

push:
	docker tag $(IMAGE_NAME):$(TAG) bnegromonte/$(IMAGE_NAME):$(TAG)
	docker push bnegromonte/$(IMAGE_NAME):$(TAG)