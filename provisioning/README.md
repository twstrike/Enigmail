# enigmail-provisioning
Contains provisioning scripts for developing Enigmail, for Vagrant and Docker

If you have problems with permissions on the shared directory, this incantation is useful:
 chcon -Rt svirt_sandbox_file_t $DIR

## Quick Setup With Docker
Please follow your [OS specific instructions](https://docs.docker.com/installation/#installation) to install docker on your system.

Once docker is installed...

1. [Create a docker group.](https://docs.docker.com/installation/ubuntulinux/#create-a-docker-group) Creating this group will keep you from having to use sudo each time you call the docker client.
2. Start the docker daemon. Those platform specific instructions should be in the docker docs after the installation steps. If you created the docker user group in step one, this will be the only step that requires `sudo`.
3. `./provisioning/docker-init.sh`
4. `./provisioning/docker-build.sh`
5. `./provisioning/docker-test.sh`

## Quick Setup With Vagrant
Please follow your OS specific instructions to install the following tool dependencies on your system:
* [Vagrant](https://www.vagrantup.com)
* Vagrant compatible virtualization software (i.e. virtualbox, vmware...)

Note: Virtualbox has default support on vagrant so if you use VMWare, AWS, etc. you must first install their respective vagrant plugins.

Once the vagrant tools are installed...

1. `cd provisioning`
2. `vagrant up` - Call vagrant to grab an instance of Ubuntu and provision it
3. `vagrant ssh` - ssh into the Ubuntu machine
4. `cd /enigmail-src` - This will be the same directory as the main project folder.
5. `./build.sh `
6. `./test.sh `
